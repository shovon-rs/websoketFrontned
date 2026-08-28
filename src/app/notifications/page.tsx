"use client";
import { AppShell } from "@/components/AppShell";
import * as notificationsApi from "@/lib/api/notifications.api";
import { useAuth } from "@/lib/auth-context";
import { isPushSupported, subscribePush } from "@/lib/push";
import type { AppNotification } from "@/lib/types";
import { useCountdown } from "@/lib/use-countdown";
import { useWs } from "@/lib/ws-context";
import {
	Bell,
	BellRing,
	Check,
	FileText,
	MessageCircle,
	PhoneIncoming,
	Radio,
	User,
} from "lucide-react";
import Link from "next/link";
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
	if (n.data?.kind === "announcement") return Radio;
	return icons[n.type] ?? icons[n.title] ?? Bell;
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

export default function Notifications() {
	const { status: authStatus } = useAuth();
	const { subscribe, send } = useWs();
	const [items, setItems] = useState<AppNotification[]>([]);
	const [pushState, setPushState] = useState<
		"idle" | "enabling" | "enabled" | "unsupported" | "error"
	>(isPushSupported() ? "idle" : "unsupported");

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
	}

	return (
		<AppShell
			title="Notifications"
			subtitle="Stay up to date with your workspace."
		>
			<div className="page narrow">
				<section className="card notification-card">
					<div className="card-head">
						<div>
							<h3>All notifications</h3>
							<p>{unreadCount} unread updates</p>
						</div>
						<div style={{ display: "flex", gap: 8 }}>
							{pushState !== "unsupported" && (
								<button
									className="plain"
									onClick={enablePush}
									disabled={pushState === "enabling" || pushState === "enabled"}
								>
									<BellRing
										size={14}
										style={{ verticalAlign: "-2px", marginRight: 4 }}
									/>
									{pushState === "enabled"
										? "Push enabled"
										: pushState === "enabling"
											? "Enabling…"
											: "Enable push"}
								</button>
							)}
							<button
								className="plain"
								onClick={markAllRead}
								disabled={unreadCount === 0}
							>
								Mark all as read
							</button>
						</div>
					</div>
					{items.length === 0 && (
						<p className="quiet" style={{ padding: 20 }}>
							No notifications yet.
						</p>
					)}
					{items.map((n) => {
						const Icon = iconFor(n);
						return (
							<button
								className={`notification-row ${!n.readAt ? "unread" : ""}`}
								onClick={() => markRead(n)}
								key={n.id}
							>
								<span className="tiny-icon coral">
									<Icon />
								</span>
								<span>
									<strong>{n.title}</strong>
									<small>{n.body}</small>
								</span>
								{n.data?.kind === "announcement" && (
									<AnnouncementRowExtra n={n} />
								)}
								<time>{timeAgo(n.createdAt)}</time>
								{!n.readAt && <i />}
							</button>
						);
					})}
				</section>
			</div>
		</AppShell>
	);
}
