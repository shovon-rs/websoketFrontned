"use client";
import { AppShell } from "@/components/AppShell";
import * as notificationsApi from "@/lib/api/notifications.api";
import { useAuth } from "@/lib/auth-context";
import { staggerContainer, staggerItem, tapScale } from "@/lib/motion";
import { isPushSupported, subscribePush } from "@/lib/push";
import type { AppNotification } from "@/lib/types";
import { useCountdown } from "@/lib/use-countdown";
import { useWs } from "@/lib/ws-context";
import { AnimatePresence, motion } from "framer-motion";
import {
	Bell,
	BellOff,
	BellRing,
	Check,
	CheckCheck,
	FileText,
	MessageCircle,
	PhoneIncoming,
	Radio,
	User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const icons: Record<string, typeof MessageCircle> = {
	"message:new": MessageCircle,
	"notification:new": Bell,
	"call:ringing": PhoneIncoming,
	"announcement:new": Radio,
	file: FileText,
	user: User,
	check: Check,
};

function iconFor(n: AppNotification) {
	// n.type is a severity ("info"/"success"/...), not an event-type string, so it never
	// actually matches these keys — data.kind is what distinguishes an announcement in practice.
	if (n.data?.kind === "announcement" || n.data?.kind === "livestream-request") return Radio;
	if (typeof n.data?.callId === "string") return PhoneIncoming;
	if (typeof n.data?.documentId === "string") return FileText;
	if (typeof n.data?.conversationId === "string") return MessageCircle;
	return icons[n.type] ?? icons[n.title] ?? Bell;
}

/** Distinct accent per notification kind, mostly so a wall of identical peach icons doesn't
 * read as one undifferentiated stream — matches the colored-chip language used elsewhere
 * (dashboard metrics, quick actions). */
function colorFor(n: AppNotification): string {
	const data = n.data;
	if (data?.kind === "announcement" || data?.kind === "livestream-request") return "coral";
	if (typeof data?.callId === "string") return "green";
	if (typeof data?.documentId === "string") return "violet";
	if (typeof data?.conversationId === "string") return "blue";
	if (typeof data?.taskId === "string") return "gold";
	return "indigo";
}

const REACTION_PREFIX = "__relay_reaction__:";

/** A reaction notification's body is the raw wire payload (`__relay_reaction__:{"emoji":"😀",...}`),
 * never meant to be shown as-is — mirrors the same de-serialization the chat thread does for
 * reaction messages, just for the notification feed instead. */
function bodyFor(n: AppNotification): string {
	if (!n.body.startsWith(REACTION_PREFIX)) return n.body;
	try {
		const parsed = JSON.parse(n.body.slice(REACTION_PREFIX.length)) as { emoji?: unknown };
		if (typeof parsed.emoji === "string" && parsed.emoji) {
			return `Reacted ${parsed.emoji} to your message`;
		}
	} catch {
		// fall through to the generic label below
	}
	return "Reacted to your message";
}

function AnnouncementRowExtra({ n }: { n: AppNotification }) {
	const announcementId = n.data?.announcementId as string | undefined;
	const scheduledAt =
		(n.data?.scheduledAt as string | null | undefined) ?? null;
	const { label, isLive } = useCountdown(scheduledAt);
	if (!announcementId) return null;

	return (
		<span className="notification-live" onClick={(e) => e.stopPropagation()}>
			{scheduledAt && <span>{isLive ? "LIVE" : label}</span>}
			<Link href={`/live/${announcementId}`} className="plain">
				Join now
			</Link>
		</span>
	);
}

function timeAgo(iso: string): string {
	const diffMs = Date.now() - new Date(iso).getTime();
	const minutes = Math.round(diffMs / 60000);
	if (minutes < 1) return "Just now";
	if (minutes < 60) return `${minutes} min ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return new Date(iso).toLocaleDateString();
}

function notificationDestination(notification: AppNotification): string | null {
	const data = notification.data;
	if (!data) return null;
	if (typeof data.conversationId === "string") return `/chat/${data.conversationId}`;
	if (typeof data.callId === "string") return `/call/${data.callId}`;
	if (typeof data.documentId === "string") return `/collab/${data.documentId}`;
	if (data.kind === "tracking:shared" || typeof data.sessionId === "string") return "/tracking";
	if (typeof data.announcementId === "string") return `/live/${data.announcementId}`;
	if (data.kind === "livestream-request") return "/live";
	if (typeof data.taskId === "string") return `/tasks/${data.taskId}`;
	return null;
}

export default function Notifications() {
	const router = useRouter();
	const { status: authStatus } = useAuth();
	const { subscribe, send } = useWs();
	const [items, setItems] = useState<AppNotification[]>([]);
	const [pushState, setPushState] = useState<
		"idle" | "enabling" | "enabled" | "unsupported" | "error"
	>(isPushSupported() ? "idle" : "unsupported");
	const [justMarkedAll, setJustMarkedAll] = useState(false);

	// AppShell redirects to /login when unauthenticated, but it still renders this component's
	// effects on the way there — wait for a real session so we don't fire a doomed request.
	useEffect(() => {
		if (authStatus !== "authenticated") return;
		notificationsApi.listNotifications().then(setItems);
	}, [authStatus]);

	useEffect(() => {
		return subscribe("notification:new", (event) => {
			const notification = event.payload as AppNotification;
			setItems((prev) =>
				prev.some((n) => n.id === notification.id)
					? prev
					: [notification, ...prev],
			);
		});
	}, [subscribe]);

	async function enablePush() {
		setPushState("enabling");
		try {
			await subscribePush();
			setPushState("enabled");
		} catch {
			setPushState("error");
		}
	}

	const unreadCount = items.filter((n) => !n.readAt).length;

	function markRead(notification: AppNotification) {
		if (notification.readAt) return;
		setItems((current) =>
			current.map((item) =>
				item.id === notification.id
					? { ...item, readAt: new Date().toISOString() }
					: item,
			),
		);
		send("notification:read", { notificationId: notification.id });
	}

	function markAllRead() {
		if (unreadCount === 0) return;
		setItems((current) =>
			current.map((item) => ({
				...item,
				readAt: item.readAt ?? new Date().toISOString(),
			})),
		);
		send("notification:read-all", {});
		setJustMarkedAll(true);
		window.setTimeout(() => setJustMarkedAll(false), 1600);
	}

	function openNotification(notification: AppNotification) {
		markRead(notification);
		const destination = notificationDestination(notification);
		if (destination) router.push(destination);
	}

	return (
		<AppShell
			title="Notifications"
			subtitle="Stay up to date with your workspace."
		>
			<div className="page notifications-grid">
				<motion.section
					className="card notification-card"
					initial={{ opacity: 0, y: 14 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
				>
					<div className="card-head">
						<div>
							<h3>All notifications</h3>
							<p>{unreadCount} unread updates</p>
						</div>
					</div>
					{items.length === 0 && (
						<div className="notification-empty">
							<BellOff aria-hidden="true" />
							<p className="quiet" style={{ margin: 0 }}>
								No notifications yet.
							</p>
						</div>
					)}
					<motion.div variants={staggerContainer} initial="hidden" animate="visible">
						<AnimatePresence initial={false}>
							{items.map((n) => {
								const Icon = iconFor(n);
								return (
									<motion.button
										className={`notification-row ${!n.readAt ? "unread" : ""}`}
										onClick={() => openNotification(n)}
										key={n.id}
										layout
										variants={staggerItem}
										initial="hidden"
										animate="visible"
										exit={{ opacity: 0, height: 0 }}
									>
										<span className={`tiny-icon ${colorFor(n)}`}>
											<Icon />
										</span>
										<span>
											<strong>{n.title}</strong>
											<small>{bodyFor(n)}</small>
										</span>
										{n.data?.kind === "announcement" && (
											<AnnouncementRowExtra n={n} />
										)}
										<time>{timeAgo(n.createdAt)}</time>
										{!n.readAt && <i />}
									</motion.button>
								);
							})}
						</AnimatePresence>
					</motion.div>
				</motion.section>

				<aside className="card notification-prefs-card">
					<h3>Overview</h3>
					<p>Your notification activity at a glance.</p>
					<div className="notification-stats">
						<div className="notification-stat">
							<strong>{items.length}</strong>
							<small>Total</small>
						</div>
						<div className="notification-stat">
							<strong>{unreadCount}</strong>
							<small>Unread</small>
						</div>
					</div>
					{pushState !== "unsupported" && (
						<button
							className="plain wide"
							onClick={enablePush}
							disabled={pushState === "enabling" || pushState === "enabled"}
						>
							<BellRing size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
							{pushState === "enabled"
								? "Push enabled"
								: pushState === "enabling"
									? "Enabling…"
									: "Enable push"}
						</button>
					)}
					<motion.button
						className="plain wide"
						onClick={markAllRead}
						disabled={unreadCount === 0}
						whileTap={tapScale}
					>
						{justMarkedAll ? (
							<motion.span
								key="done"
								initial={{ opacity: 0, scale: 0.85 }}
								animate={{ opacity: 1, scale: 1 }}
								style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
							>
								<CheckCheck size={14} /> All read
							</motion.span>
						) : (
							"Mark all as read"
						)}
					</motion.button>
				</aside>
			</div>
		</AppShell>
	);
}
