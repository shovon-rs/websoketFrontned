"use client";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { UserSearchDropdown } from "@/components/UserSearchDropdown";
import { ApiError } from "@/lib/api-client";
import * as chatApi from "@/lib/api/chat.api";
import * as usersApi from "@/lib/api/users.api";
import { useAuth } from "@/lib/auth-context";
import { formatLastSeen } from "@/lib/time";
import type { Conversation, Message, PresenceUser, User } from "@/lib/types";
import { useWs } from "@/lib/ws-context";
import { makeEventId } from "@/lib/ws-envelope";
import {
	scaleIn,
	staggerContainer,
	staggerItem,
	tapScale,
	EASE_OUT,
} from "@/lib/motion";
import { AnimatePresence, motion } from "framer-motion";
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
import { CreateGroupDialog } from "../CreateGroupDialog";
import { GroupInfoDialog } from "../GroupInfoDialog";

const PALETTE = ["coral", "blue", "violet", "gold", "green"];
const REACTION_PREFIX = "__relay_reaction__:";
const REACTION_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// Outgoing messages settle in from the right, incoming ones from the left — a subtle, tasteful
// distinction rather than a full bubble-flight animation.
const incomingBubble = {
	hidden: { opacity: 0, x: -16, y: 6 },
	visible: { opacity: 1, x: 0, y: 0, transition: { duration: 0.32, ease: EASE_OUT } },
};
const outgoingBubble = {
	hidden: { opacity: 0, x: 16, y: 6 },
	visible: { opacity: 1, x: 0, y: 0, transition: { duration: 0.32, ease: EASE_OUT } },
};

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
function initialsOf(name: string | null | undefined): string {
	const trimmed = (name ?? "").trim();
	if (!trimmed) return "?";
	const parts = trimmed.split(/\s+/);
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
	const [groupDialogOpen, setGroupDialogOpen] = useState(false);
	const [infoOpen, setInfoOpen] = useState(false);
	const [conversationListOpen, setConversationListOpen] = useState(false);
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
	const messagesContainerRef = useRef<HTMLDivElement>(null);
	const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
		new Map(),
	);
	const lastTypingSentRef = useRef(0);
	const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const [presence, setPresence] = useState<Map<string, PresenceUser>>(new Map());

	const loadPresence = useCallback(() => {
		usersApi.getPresence().then((users) => {
			setPresence(new Map(users.map((u) => [u.id, u])));
		});
	}, []);

	// Messenger/WhatsApp-style presence: who's online right now and when everyone else was last
	// active, kept fresh on a short poll and refreshed immediately on every (re)connect.
	useEffect(() => {
		loadPresence();
		const timer = window.setInterval(loadPresence, 15000);
		return () => window.clearInterval(timer);
	}, [loadPresence]);

	useEffect(() => {
		if (wsStatus === "connected") loadPresence();
	}, [wsStatus, loadPresence]);

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
	const otherPresence = otherMember ? presence.get(otherMember.id) : undefined;

	const isGroup = activeConversation?.type === "group";
	const headerLabel = isGroup
		? (activeConversation?.name ?? "Group")
		: (otherMember?.displayName ?? "Conversation");

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

	// Mark the open thread read whenever it's actually being looked at: on open/reconnect while
	// focused, and again whenever the tab regains focus while this thread is still active.
	useEffect(() => {
		if (!conversationId || wsStatus !== "connected") return;
		if (typeof document === "undefined" || document.hidden || !document.hasFocus()) return;
		send("conversation:read", { conversationId });
	}, [conversationId, wsStatus, send]);

	useEffect(() => {
		function onFocus() {
			if (conversationId && wsStatus === "connected") {
				send("conversation:read", { conversationId });
			}
		}
		window.addEventListener("focus", onFocus);
		document.addEventListener("visibilitychange", onFocus);
		return () => {
			window.removeEventListener("focus", onFocus);
			document.removeEventListener("visibilitychange", onFocus);
		};
	}, [conversationId, wsStatus, send]);

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
				if (!document.hidden && document.hasFocus()) {
					send("conversation:read", { conversationId });
				}
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

		const offRead = subscribe("message:read", (event) => {
			const payload = event.payload as {
				conversationId: string;
				userId: string;
				lastReadAt: string;
			};
			if (payload.conversationId !== conversationId || payload.userId === user?.id) return;
			const readAt = new Date(payload.lastReadAt).getTime();
			setMessages((prev) =>
				prev.map((m) =>
					m.senderId === user?.id &&
					m.status !== "sending" &&
					m.status !== "failed" &&
					new Date(m.createdAt).getTime() <= readAt
						? { ...m, status: "read" }
						: m,
				),
			);
		});

		return () => {
			offNew();
			offTypingStart();
			offTypingStop();
			offRead();
		};
	}, [conversationId, subscribe, send, user]);

	// Keep the group's name/roster in sync for everyone in the room, not just whoever made the change.
	useEffect(() => {
		function updateConversation(id: string, patch: (c: Conversation) => Conversation) {
			setConversations((prev) => prev.map((c) => (c.id === id ? patch(c) : c)));
		}

		const offRenamed = subscribe("conversation:updated", (event) => {
			const payload = event.payload as { conversationId: string; name: string };
			updateConversation(payload.conversationId, (c) => ({ ...c, name: payload.name }));
		});

		const offMembersAdded = subscribe("conversation:members-added", (event) => {
			const payload = event.payload as {
				conversationId: string;
				members: Conversation["members"];
			};
			updateConversation(payload.conversationId, (c) => ({
				...c,
				members: [...c.members, ...payload.members.filter((m) => !c.members.some((existing) => existing.userId === m.userId))],
			}));
		});

		const offMemberRemoved = subscribe("conversation:member-removed", (event) => {
			const payload = event.payload as {
				conversationId: string;
				userId: string;
				promotedAdminId: string | null;
			};
			if (payload.userId === user?.id) {
				// We were removed (or left from another tab/device) — this thread is no longer ours.
				setConversations((prev) => prev.filter((c) => c.id !== payload.conversationId));
				if (payload.conversationId === conversationId) router.replace("/chat");
				return;
			}
			updateConversation(payload.conversationId, (c) => ({
				...c,
				members: c.members
					.filter((m) => m.userId !== payload.userId)
					.map((m) => (m.userId === payload.promotedAdminId ? { ...m, role: "admin" as const } : m)),
			}));
		});

		const offRoleChanged = subscribe("conversation:member-role-changed", (event) => {
			const payload = event.payload as { conversationId: string; userId: string; role: "admin" | "member" };
			updateConversation(payload.conversationId, (c) => ({
				...c,
				members: c.members.map((m) => (m.userId === payload.userId ? { ...m, role: payload.role } : m)),
			}));
		});

		return () => {
			offRenamed();
			offMembersAdded();
			offMemberRemoved();
			offRoleChanged();
		};
	}, [subscribe, conversationId, user, router]);

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

	// Jump the message pane itself to its bottom (not scrollIntoView, which walks every
	// scrollable ancestor and can land short of the true bottom in a nested flex layout like
	// this one — setting scrollTop directly on the actual scrolling element is unambiguous).
	useLayoutEffect(() => {
		if (normalizedSearch) return;
		const el = messagesContainerRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [conversationId, messages, typingNames.length, normalizedSearch]);

	// Attachments/images inside messages load asynchronously and can grow the container after
	// the layout effect above already ran — nudge back to bottom once more shortly after mount
	// and after the message list changes, matching Messenger/WhatsApp's behavior of always
	// opening a thread already at its newest message.
	useEffect(() => {
		if (normalizedSearch) return;
		const el = messagesContainerRef.current;
		if (!el) return;
		const timer = window.setTimeout(() => {
			el.scrollTop = el.scrollHeight;
		}, 120);
		return () => window.clearTimeout(timer);
	}, [conversationId, messages, normalizedSearch]);

	return (
		<AppShell title="Messages">
			<div className={`chat-layout${conversationListOpen ? " show-conversations" : ""}`}>
				<aside className="conversation-panel">
					<button className="mobile-conversations plain" onClick={() => setConversationListOpen(false)}>Back to message</button>
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
							<button
								type="button"
								className="plain"
								style={{ marginTop: 8 }}
								onClick={() => {
									setNewConvoOpen(false);
									setGroupDialogOpen(true);
								}}
							>
								Create a group instead
							</button>
							{convoError && (
								<p className="auth-error" style={{ marginTop: 8 }}>
									{convoError}
								</p>
							)}
						</div>
					)}
					<motion.div variants={staggerContainer} initial="hidden" animate="visible">
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
								<motion.div variants={staggerItem} key={c.id}>
									<Link
										href={`/chat/${c.id}`}
										onClick={() => setConversationListOpen(false)}
										className={`conversation ${conversationId === c.id ? "selected" : ""}`}
									>
										<Avatar
											initials={initialsOf(label)}
											color={colorFor(c.id)}
											online={c.type === "group" ? undefined : presence.get(other?.id ?? "")?.online}
										/>
										<div>
											<strong>{label}</strong>
											<small>{preview}</small>
										</div>
									</Link>
								</motion.div>
							);
						})}
					</motion.div>
				</aside>
				<section className="thread">
					<header className="thread-head">
						<button className="mobile-conversations" onClick={() => setConversationListOpen(true)} aria-label="Show conversations">Conversations</button>
						<div>
							<Avatar
								initials={initialsOf(headerLabel)}
								color={colorFor(conversationId)}
								online={isGroup ? undefined : otherPresence?.online}
							/>
							<span>
								<strong>{headerLabel}</strong>
								<small>
									{isGroup ? (
										`${activeConversation?.members.length ?? 0} members`
									) : (
										<>
											<i className={otherPresence?.online ? "" : "offline"} />
											{otherPresence?.online
												? "Active now"
												: formatLastSeen(otherPresence?.lastSeenAt ?? null)}
										</>
									)}
								</small>
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
								disabled={isGroup || !otherMember || dialing !== null}
								aria-label="Start audio call"
							>
								<Phone />
							</button>
							<button
								onClick={() => startCall("video")}
								disabled={isGroup || !otherMember || dialing !== null}
								aria-label="Start video call"
							>
								<Video />
							</button>
							<button
								onClick={() => setInfoOpen(true)}
								disabled={!isGroup}
								aria-label={isGroup ? "Group info" : "Conversation information"}
							>
								<Info />
							</button>
						</div>
					</header>
					{/* AnimatePresence: gives the search bar reveal/dismiss an animated slide instead of a hard cut. */}
					<AnimatePresence>
					{messageSearchOpen && (
						<motion.div
							className="message-search"
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: "auto" }}
							exit={{ opacity: 0, height: 0 }}
							transition={{ duration: 0.2, ease: EASE_OUT }}
						>
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
						</motion.div>
					)}
					</AnimatePresence>
					<div className="messages" ref={messagesContainerRef}>
					<div className="messages-inner">
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
								<motion.div
									className={`message ${mine ? "mine" : ""}`}
									key={m.eventId}
									variants={mine ? outgoingBubble : incomingBubble}
									initial="hidden"
									animate="visible"
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
											<AnimatePresence>
											{reactionPickerFor === m.eventId && (
												<motion.div
													className="message-reaction-picker"
													variants={scaleIn}
													initial="hidden"
													animate="visible"
													exit="exit"
												>
													{REACTION_OPTIONS.map((emoji) => (
														<motion.button
															whileTap={tapScale}
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
														</motion.button>
													))}
												</motion.div>
											)}
											</AnimatePresence>
										</div>
										{reactionCounts.size > 0 && (
											<div className="message-reactions">
												<AnimatePresence initial={false}>
												{Array.from(reactionCounts).map(([emoji, count]) => (
													<motion.button
														key={emoji}
														className={myReaction === emoji ? "mine" : ""}
														onClick={() =>
															sendReaction(
																m.eventId,
																myReaction === emoji ? "" : emoji,
															)
														}
														aria-label={`${emoji}, ${count} ${count === 1 ? "reaction" : "reactions"}`}
														initial={{ opacity: 0, scale: 0.5 }}
														animate={{ opacity: 1, scale: 1 }}
														exit={{ opacity: 0, scale: 0.5 }}
														transition={{ duration: 0.22, ease: EASE_OUT }}
														whileTap={tapScale}
													>
														{emoji}
														<span>{count}</span>
													</motion.button>
												))}
												</AnimatePresence>
											</div>
										)}
										{mine && (
											<AnimatePresence mode="wait" initial={false}>
												<motion.small
													className={`delivered${m.status === "read" ? " seen" : ""}`}
													key={m.status}
													initial={{ opacity: 0, scale: 0.9 }}
													animate={{ opacity: 1, scale: 1 }}
													transition={{ duration: 0.18, ease: EASE_OUT }}
												>
													{m.status === "sending"
														? "Sending…"
														: m.status === "failed"
															? "Failed to send"
															: m.status === "read"
																? "Seen ✓✓"
																: "Delivered ✓"}
												</motion.small>
											</AnimatePresence>
										)}
									</div>
								</motion.div>
							);
						})}
						<AnimatePresence>
						{typingNames.length > 0 && (
							<motion.div
								className="typing"
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: 6 }}
								transition={{ duration: 0.2, ease: EASE_OUT }}
							>
								<span>
									<i />
									<i />
									<i />
								</span>
								<small>
									{typingNames.join(", ")}{" "}
									{typingNames.length > 1 ? "are" : "is"} typing
								</small>
							</motion.div>
						)}
						</AnimatePresence>
						<div ref={messagesEndRef} aria-hidden="true" />
					</div>
					</div>
					<div className="composer">
						{attachment && (
							<div className={`attachment-chip${uploadingAttachment ? " uploading" : ""}`}>
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
						<AnimatePresence>
						{emojiOpen && (
							<motion.div
								className="emoji-picker"
								aria-label="Choose an emoji"
								variants={scaleIn}
								initial="hidden"
								animate="visible"
								exit="exit"
							>
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
							</motion.div>
						)}
						</AnimatePresence>
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
							<motion.button
								className="send"
								onClick={sendMessage}
								disabled={uploadingAttachment}
								aria-label="Send message"
								whileTap={tapScale}
							>
								<Send />
							</motion.button>
						</div>
						<small>Press Enter to send · Shift + Enter for a new line</small>
					</div>
				</section>
			</div>

			<AnimatePresence>
			{groupDialogOpen && (
				<CreateGroupDialog
					onClose={() => setGroupDialogOpen(false)}
					onCreated={(conversation) => {
						setConversations((prev) =>
							prev.some((c) => c.id === conversation.id) ? prev : [conversation, ...prev],
						);
						setGroupDialogOpen(false);
						router.push(`/chat/${conversation.id}`);
					}}
				/>
			)}
			</AnimatePresence>

			<AnimatePresence>
			{infoOpen && activeConversation && user && (
				<GroupInfoDialog
					conversation={activeConversation}
					currentUserId={user.id}
					onClose={() => setInfoOpen(false)}
					onUpdated={(updated) => {
						setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
					}}
					onLeft={() => {
						setInfoOpen(false);
						setConversations((prev) => prev.filter((c) => c.id !== conversationId));
						router.replace("/chat");
					}}
				/>
			)}
			</AnimatePresence>
		</AppShell>
	);
}
