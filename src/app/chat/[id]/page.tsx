"use client";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { UserSearchDropdown } from "@/components/UserSearchDropdown";
import { ApiError } from "@/lib/api-client";
import * as chatApi from "@/lib/api/chat.api";
import { useAuth } from "@/lib/auth-context";
import type { Conversation, Message, User } from "@/lib/types";
import { useWs } from "@/lib/ws-context";
import { makeEventId } from "@/lib/ws-envelope";
import {
	FileText,
	Info,
	Paperclip,
	Phone,
	Search,
	Send,
	Smile,
	Video,
	X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

const PALETTE = ["coral", "blue", "violet", "gold", "green"];
const REACTION_PREFIX = "__relay_reaction__:";
const REACTION_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function parseReaction(
	content: string,
): { targetEventId: string; emoji: string } | null {
	if (!content.startsWith(REACTION_PREFIX)) return null;
	try {
		const value = JSON.parse(content.slice(REACTION_PREFIX.length)) as {
			targetEventId?: unknown;
			emoji?: unknown;
		};
		if (
			typeof value.targetEventId !== "string" ||
			typeof value.emoji !== "string"
		)
			return null;
		return { targetEventId: value.targetEventId, emoji: value.emoji };
	} catch {
		return null;
	}
}
function colorFor(id: string): string {
	let hash = 0;
	for (let i = 0; i < id.length; i++)
		hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
	return PALETTE[hash % PALETTE.length];
}
function initialsOf(name: string): string {
	const parts = name.trim().split(/\s+/);
	return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
function formatTime(iso: string): string {
	return new Date(iso).toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit",
	});
}

export default function ChatConversation({
	params,
}: {
	params: { id: string };
}) {
	const conversationId = params.id;
	const router = useRouter();
	const { user } = useAuth();
	const { status: wsStatus, send, subscribe } = useWs();

	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [messages, setMessages] = useState<Message[]>([]);
	const [text, setText] = useState("");
	const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
	const [newConvoOpen, setNewConvoOpen] = useState(false);
	const [creatingConvo, setCreatingConvo] = useState(false);
	const [convoError, setConvoError] = useState<string | null>(null);
	const [messageSearchOpen, setMessageSearchOpen] = useState(false);
	const [messageSearch, setMessageSearch] = useState("");
	const [emojiOpen, setEmojiOpen] = useState(false);
	const [attachment, setAttachment] = useState<File | null>(null);
	const [uploadingAttachment, setUploadingAttachment] = useState(false);
	const [composerError, setComposerError] = useState<string | null>(null);
	const [dialing, setDialing] = useState<"audio" | "video" | null>(null);
	const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(
		null,
	);

	const lastEventIdRef = useRef<string | undefined>(undefined);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
		new Map(),
	);
	const lastTypingSentRef = useRef(0);
	const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const activeConversation = conversations.find((c) => c.id === conversationId);

	const memberById = useMemo(() => {
		const map = new Map<string, { displayName: string; email: string }>();
		activeConversation?.members.forEach((m) => map.set(m.userId, m.user));
		return map;
	}, [activeConversation]);

	const otherMember = useMemo(
		() => activeConversation?.members.find((m) => m.userId !== user?.id)?.user,
		[activeConversation, user],
	);

	// Load the sidebar conversation list once.
	useEffect(() => {
		chatApi.listConversations().then(setConversations);
	}, []);

	// Load history + join the room whenever the active conversation changes.
	useEffect(() => {
		if (!conversationId) return;
		setMessages([]);
		lastEventIdRef.current = undefined;

		chatApi.getMessages(conversationId).then((history) => {
			setMessages(
				history.map((m) => ({ ...m, status: m.status as Message["status"] })),
			);
			lastEventIdRef.current = history.at(-1)?.eventId;
		});

		return () => {
			send("chat:leave", { conversationId });
		};
	}, [conversationId, send]);

	// Room membership lives on the server connection, not the client — rejoin on every (re)connect.
	useEffect(() => {
		if (wsStatus === "connected") send("chat:join", { conversationId });
	}, [wsStatus, conversationId, send]);

	// Reconnect catch-up: fetch anything sent while the socket was down.
	const prevStatusRef = useRef(wsStatus);
	useEffect(() => {
		if (
			prevStatusRef.current !== "connected" &&
			wsStatus === "connected" &&
			lastEventIdRef.current
		) {
			chatApi
				.getMessages(conversationId, lastEventIdRef.current)
				.then((missed) => {
					if (missed.length === 0) return;
					setMessages((prev) => {
						const seen = new Set(prev.map((m) => m.eventId));
						const fresh = missed.filter((m) => !seen.has(m.eventId));
						lastEventIdRef.current =
							missed.at(-1)?.eventId ?? lastEventIdRef.current;
						return [
							...prev,
							...fresh.map((m) => ({
								...m,
								status: m.status as Message["status"],
							})),
						];
					});
				});
		}
		prevStatusRef.current = wsStatus;
	}, [wsStatus, conversationId]);

	useEffect(() => {
		const offNew = subscribe("message:new", (event) => {
			const payload = event.payload as {
				id: string;
				conversationId: string;
				senderId: string;
				content: string;
				createdAt: string;
				attachment?: Message["attachment"];
			};
			if (payload.conversationId !== conversationId) return;

			lastEventIdRef.current = event.eventId;
			setMessages((prev) => {
				// Reconcile our own optimistic entry (keyed by the eventId we sent) instead of duplicating it.
				const optimisticIndex = prev.findIndex(
					(m) => m.eventId === event.eventId,
				);
				const resolved: Message = {
					id: payload.id,
					eventId: event.eventId,
					conversationId: payload.conversationId,
					senderId: payload.senderId,
					content: payload.content,
					createdAt: payload.createdAt,
					status: "delivered",
					attachment: payload.attachment,
				};
				if (optimisticIndex >= 0) {
					const next = [...prev];
					next[optimisticIndex] = resolved;
					return next;
				}
				if (prev.some((m) => m.id === payload.id)) return prev;
				return [...prev, resolved];
			});

			if (payload.senderId !== user?.id) {
				send("message:ack", { eventId: event.eventId });
			}
		});

		const offTypingStart = subscribe("typing:start", (event) => {
			const payload = event.payload as {
				conversationId: string;
				userId: string;
			};
			if (
				payload.conversationId !== conversationId ||
				payload.userId === user?.id
			)
				return;
			setTypingUsers((prev) => new Set(prev).add(payload.userId));
			const timers = typingTimersRef.current;
			clearTimeout(timers.get(payload.userId));
			timers.set(
				payload.userId,
				setTimeout(
					() =>
						setTypingUsers((prev) => {
							const next = new Set(prev);
							next.delete(payload.userId);
							return next;
						}),
					4000,
				),
			);
		});

		const offTypingStop = subscribe("typing:stop", (event) => {
			const payload = event.payload as {
				conversationId: string;
				userId: string;
			};
			if (payload.conversationId !== conversationId) return;
			setTypingUsers((prev) => {
				const next = new Set(prev);
				next.delete(payload.userId);
				return next;
			});
		});

		return () => {
			offNew();
			offTypingStart();
			offTypingStop();
		};
	}, [conversationId, subscribe, send, user]);

	useEffect(() => {
		if (!dialing) return undefined;
		const offInitiated = subscribe("call:initiated", (event) => {
			setDialing(null);
			router.push(`/call/${(event.payload as { callId: string }).callId}`);
		});
		const offError = subscribe("error", (event) => {
			setDialing(null);
			setComposerError(
				event.error?.message ?? "Could not start the call. Please try again.",
			);
		});
		const timeout = setTimeout(() => {
			setDialing(null);
			setComposerError(
				"The call could not be started. Check your connection and try again.",
			);
		}, 15000);
		return () => {
			offInitiated();
			offError();
			clearTimeout(timeout);
		};
	}, [dialing, router, subscribe]);

	const sendMessage = useCallback(async () => {
		if (uploadingAttachment) return;
		if (!text.trim() && !attachment) return;
		if (!user) return;

		let uploaded: Awaited<ReturnType<typeof chatApi.uploadAttachment>> | null =
			null;
		if (attachment) {
			setUploadingAttachment(true);
			setComposerError(null);
			try {
				uploaded = await chatApi.uploadAttachment(conversationId, attachment);
			} catch (err) {
				setComposerError(
					err instanceof ApiError
						? err.message
						: "Could not upload the file. Please try again.",
				);
				return;
			} finally {
				setUploadingAttachment(false);
			}
		}

		const eventId = makeEventId();
		const optimistic: Message = {
			id: eventId,
			eventId,
			conversationId,
			senderId: user.id,
			content: text,
			status: "sending",
			createdAt: new Date().toISOString(),
			attachment: uploaded
				? {
						id: uploaded.attachmentId,
						fileName: uploaded.fileName,
						mimeType: uploaded.mimeType,
						size: uploaded.size,
						url: uploaded.url,
					}
				: null,
		};
		setMessages((prev) => [...prev, optimistic]);
		send(
			"message:send",
			{ conversationId, content: text, attachmentId: uploaded?.attachmentId },
			eventId,
		);
		setText("");
		setAttachment(null);
		setEmojiOpen(false);
		setComposerError(null);
	}, [attachment, uploadingAttachment, text, user, conversationId, send]);

	const sendReaction = useCallback(
		(targetEventId: string, emoji: string) => {
			if (!user) return;
			const eventId = makeEventId();
			const content = `${REACTION_PREFIX}${JSON.stringify({ targetEventId, emoji })}`;
			const optimistic: Message = {
				id: eventId,
				eventId,
				conversationId,
				senderId: user.id,
				content,
				status: "sending",
				createdAt: new Date().toISOString(),
			};
			setMessages((previous) => [...previous, optimistic]);
			send("message:send", { conversationId, content }, eventId);
			setReactionPickerFor(null);
		},
		[conversationId, send, user],
	);

	function startCall(callType: "audio" | "video") {
		if (!otherMember || dialing) return;
		setComposerError(null);
		setDialing(callType);
		send("call:initiate", { calleeId: otherMember.id, callType });
	}

	function onTyping(value: string) {
		setText(value);
		const now = Date.now();
		if (now - lastTypingSentRef.current > 2000) {
			send("typing:start", { conversationId });
			lastTypingSentRef.current = now;
		}
		if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
		typingStopTimerRef.current = setTimeout(
			() => send("typing:stop", { conversationId }),
			3000,
		);
	}

	async function startConversation(recipient: User) {
		setConvoError(null);
		setCreatingConvo(true);
		try {
			const conversation = await chatApi.createConversation({
				memberIds: [recipient.id],
				type: "direct",
			});
			setConversations((prev) =>
				prev.some((c) => c.id === conversation.id)
					? prev
					: [conversation, ...prev],
			);
			setNewConvoOpen(false);
			router.push(`/chat/${conversation.id}`);
		} catch (err) {
			setConvoError(
				err instanceof ApiError
					? err.message
					: "Could not start the conversation. Please try again.",
			);
		} finally {
			setCreatingConvo(false);
		}
	}

	const typingNames = Array.from(typingUsers).map(
		(id) => memberById.get(id)?.displayName.split(" ")[0] ?? "Someone",
	);
	const regularMessages = useMemo(
		() => messages.filter((message) => !parseReaction(message.content)),
		[messages],
	);
	const reactionsByMessage = useMemo(() => {
		const byMessage = new Map<string, Map<string, string>>();
		messages.forEach((message) => {
			const reaction = parseReaction(message.content);
			if (!reaction) return;
			const byUser =
				byMessage.get(reaction.targetEventId) ?? new Map<string, string>();
			if (reaction.emoji) byUser.set(message.senderId, reaction.emoji);
			else byUser.delete(message.senderId);
			byMessage.set(reaction.targetEventId, byUser);
		});
		return byMessage;
	}, [messages]);
	const normalizedSearch = messageSearch.trim().toLocaleLowerCase();
	const visibleMessages = normalizedSearch
		? regularMessages.filter((message) =>
				message.content.toLocaleLowerCase().includes(normalizedSearch),
			)
		: regularMessages;

	useLayoutEffect(() => {
		if (!normalizedSearch)
			messagesEndRef.current?.scrollIntoView({ block: "end" });
	}, [messages, typingNames.length, normalizedSearch]);

	return (
		<AppShell title="Messages">
			<div className="chat-layout">
				<aside className="conversation-panel">
					<div className="filter-search">
						<Search size={17} />
						<input placeholder="Search conversations" />
					</div>
					<div className="conv-heading">
						<strong>All messages</strong>
						<button
							onClick={() => {
								setNewConvoOpen((v) => !v);
								setConvoError(null);
							}}
							aria-label={
								newConvoOpen
									? "Close new conversation"
									: "Start a new conversation"
							}
						>
							{newConvoOpen ? <X size={16} /> : "+"}
						</button>
					</div>
					{newConvoOpen && (
						<div style={{ marginBottom: 12 }}>
							<UserSearchDropdown
								onSelect={startConversation}
								placeholder="Search people by name or email…"
								autoFocus
								disabled={creatingConvo}
							/>
							{convoError && (
								<p className="auth-error" style={{ marginTop: 8 }}>
									{convoError}
								</p>
							)}
						</div>
					)}
					{conversations.map((c) => {
						const other = c.members.find((m) => m.userId !== user?.id)?.user;
						const label =
							c.type === "group"
								? (c.name ?? "Group")
								: (other?.displayName ?? "Conversation");
						const latestContent = c.messages?.[0]?.content;
						const latestReaction = latestContent
							? parseReaction(latestContent)
							: null;
						const preview = latestReaction
							? `Reacted ${latestReaction.emoji} to a message`
							: (latestContent ?? "No messages yet");
						return (
							<Link
								href={`/chat/${c.id}`}
								className={`conversation ${conversationId === c.id ? "selected" : ""}`}
								key={c.id}
							>
								<Avatar initials={initialsOf(label)} color={colorFor(c.id)} />
								<div>
									<strong>{label}</strong>
									<small>{preview}</small>
								</div>
							</Link>
						);
					})}
				</aside>
				<section className="thread">
					<header className="thread-head">
						<div>
							<Avatar
								initials={initialsOf(
									otherMember?.displayName ?? activeConversation?.name ?? "?",
								)}
								color={colorFor(conversationId)}
							/>
							<span>
								<strong>
									{otherMember?.displayName ??
										activeConversation?.name ??
										"Conversation"}
								</strong>
								<small>{activeConversation?.members.length ?? 0} members</small>
							</span>
						</div>
						<div>
							<button
								onClick={() => {
									setMessageSearchOpen((open) => !open);
									setMessageSearch("");
								}}
								aria-label="Search messages"
							>
								<Search />
							</button>
							<button
								onClick={() => startCall("audio")}
								disabled={!otherMember || dialing !== null}
								aria-label="Start audio call"
							>
								<Phone />
							</button>
							<button
								onClick={() => startCall("video")}
								disabled={!otherMember || dialing !== null}
								aria-label="Start video call"
							>
								<Video />
							</button>
							<button aria-label="Conversation information">
								<Info />
							</button>
						</div>
					</header>
					{messageSearchOpen && (
						<div className="message-search">
							<Search size={16} />
							<input
								value={messageSearch}
								onChange={(event) => setMessageSearch(event.target.value)}
								placeholder="Search older messages…"
								autoFocus
							/>
							{normalizedSearch && (
								<small>
									{visibleMessages.length}{" "}
									{visibleMessages.length === 1 ? "result" : "results"}
								</small>
							)}
							<button
								onClick={() => {
									setMessageSearchOpen(false);
									setMessageSearch("");
								}}
								aria-label="Close message search"
							>
								<X size={16} />
							</button>
						</div>
					)}
					<div className="messages">
						{normalizedSearch && visibleMessages.length === 0 && (
							<p className="message-search-empty">
								No messages match &ldquo;{messageSearch.trim()}&rdquo;.
							</p>
						)}
						{visibleMessages.map((m) => {
							const mine = m.senderId === user?.id;
							const sender = memberById.get(m.senderId);
							const messageReactions = reactionsByMessage.get(m.eventId);
							const reactionCounts = Array.from(
								messageReactions?.values() ?? [],
							).reduce(
								(counts, emoji) =>
									counts.set(emoji, (counts.get(emoji) ?? 0) + 1),
								new Map<string, number>(),
							);
							const myReaction = user
								? messageReactions?.get(user.id)
								: undefined;
							return (
								<div
									className={`message ${mine ? "mine" : ""}`}
									key={m.eventId}
								>
									{!mine && (
										<Avatar
											initials={initialsOf(sender?.displayName ?? "?")}
											color={colorFor(m.senderId)}
											size="sm"
										/>
									)}
									<div className="message-content">
										<span className="message-meta">
											<strong>
												{mine ? "You" : (sender?.displayName ?? "Unknown")}
											</strong>
											<time>{formatTime(m.createdAt)}</time>
										</span>
										{m.content && <p>{m.content}</p>}
										{m.attachment &&
											(m.attachment.mimeType.startsWith("image/") ? (
												<a
													href={m.attachment.url}
													target="_blank"
													rel="noreferrer"
												>
													<img
														className="message-attachment-image"
														src={m.attachment.url}
														alt={m.attachment.fileName}
													/>
												</a>
											) : (
												<a
													className="attachment-chip"
													href={m.attachment.url}
													target="_blank"
													rel="noreferrer"
												>
													<FileText size={16} />
													<span>
														<strong>{m.attachment.fileName}</strong>
														<small>
															{Math.ceil(m.attachment.size / 1024)} KB
														</small>
													</span>
												</a>
											))}
										<div className="message-reaction-actions">
											<button
												onClick={() =>
													setReactionPickerFor((current) =>
														current === m.eventId ? null : m.eventId,
													)
												}
												aria-label="React to message"
												aria-expanded={reactionPickerFor === m.eventId}
											>
												<Smile size={15} />
											</button>
											{reactionPickerFor === m.eventId && (
												<div className="message-reaction-picker">
													{REACTION_OPTIONS.map((emoji) => (
														<button
															className={myReaction === emoji ? "selected" : ""}
															key={emoji}
															onClick={() =>
																sendReaction(
																	m.eventId,
																	myReaction === emoji ? "" : emoji,
																)
															}
															aria-label={`${myReaction === emoji ? "Remove" : "React with"} ${emoji}`}
														>
															{emoji}
														</button>
													))}
												</div>
											)}
										</div>
										{reactionCounts.size > 0 && (
											<div className="message-reactions">
												{Array.from(reactionCounts).map(([emoji, count]) => (
													<button
														key={emoji}
														className={myReaction === emoji ? "mine" : ""}
														onClick={() =>
															sendReaction(
																m.eventId,
																myReaction === emoji ? "" : emoji,
															)
														}
														aria-label={`${emoji}, ${count} ${count === 1 ? "reaction" : "reactions"}`}
													>
														{emoji}
														<span>{count}</span>
													</button>
												))}
											</div>
										)}
										{mine && (
											<small className="delivered">
												{m.status === "sending"
													? "Sending…"
													: m.status === "failed"
														? "Failed to send"
														: "Delivered ✓"}
											</small>
										)}
									</div>
								</div>
							);
						})}
						{typingNames.length > 0 && (
							<div className="typing">
								<span>
									<i />
									<i />
									<i />
								</span>
								<small>
									{typingNames.join(", ")}{" "}
									{typingNames.length > 1 ? "are" : "is"} typing
								</small>
							</div>
						)}
						<div ref={messagesEndRef} aria-hidden="true" />
					</div>
					<div className="composer">
						{attachment && (
							<div className="attachment-chip">
								<FileText size={16} />
								<span>
									<strong>{attachment.name}</strong>
									<small>
										{uploadingAttachment
											? "Uploading…"
											: `${Math.ceil(attachment.size / 1024)} KB`}
									</small>
								</span>
								<button
									onClick={() => {
										setAttachment(null);
										setComposerError(null);
									}}
									disabled={uploadingAttachment}
									aria-label="Remove attachment"
								>
									<X size={15} />
								</button>
							</div>
						)}
						{composerError && (
							<p className="composer-error" role="alert">
								{composerError}
							</p>
						)}
						{emojiOpen && (
							<div className="emoji-picker" aria-label="Choose an emoji">
								{[
									"😀",
									"😂",
									"😍",
									"👍",
									"🎉",
									"❤️",
									"😮",
									"😢",
									"🙏",
									"🔥",
									"✅",
									"👏",
								].map((emoji) => (
									<button
										key={emoji}
										onClick={() => {
											onTyping(text + emoji);
											setEmojiOpen(false);
										}}
										aria-label={`Add ${emoji}`}
									>
										{emoji}
									</button>
								))}
							</div>
						)}
						<div>
							<input
								ref={fileInputRef}
								className="visually-hidden"
								type="file"
								onChange={(event) => {
									setAttachment(event.target.files?.[0] ?? null);
									setComposerError(null);
									event.currentTarget.value = "";
								}}
							/>
							<button
								onClick={() => fileInputRef.current?.click()}
								aria-label="Attach a file"
							>
								<Paperclip />
							</button>
							<textarea
								value={text}
								onChange={(e) => onTyping(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault();
										sendMessage();
									}
								}}
								placeholder="Write a message…"
							/>
							<button
								onClick={() => setEmojiOpen((open) => !open)}
								aria-label="Add emoji"
								aria-expanded={emojiOpen}
							>
								<Smile />
							</button>
							<button
								className="send"
								onClick={sendMessage}
								disabled={uploadingAttachment}
								aria-label="Send message"
							>
								<Send />
							</button>
						</div>
						<small>Press Enter to send · Shift + Enter for a new line</small>
					</div>
				</section>
			</div>
		</AppShell>
	);
}
