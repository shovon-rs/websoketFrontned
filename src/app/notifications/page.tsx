"use client";
import { AppShell } from "@/components/AppShell";
import { Bell, BellRing, Check, FileText, MessageCircle, PhoneIncoming, User } from "lucide-react";
import { useEffect, useState } from "react";
import * as notificationsApi from "@/lib/api/notifications.api";
import { useAuth } from "@/lib/auth-context";
import { useWs } from "@/lib/ws-context";
import { subscribePush, isPushSupported } from "@/lib/push";
import type { AppNotification } from "@/lib/types";

const icons: Record<string, typeof MessageCircle> = {
  "message:new": MessageCircle,
  "notification:new": Bell,
  "call:ringing": PhoneIncoming,
  file: FileText,
  user: User,
  check: Check,
};

function iconFor(n: AppNotification) {
  return icons[n.type] ?? icons[n.title] ?? Bell;
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
  const { subscribe } = useWs();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [pushState, setPushState] = useState<"idle" | "enabling" | "enabled" | "unsupported" | "error">(
    isPushSupported() ? "idle" : "unsupported",
  );

  // AppShell redirects to /login when unauthenticated, but it still renders this component's
  // effects on the way there — wait for a real session so we don't fire a doomed request.
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    notificationsApi.listNotifications().then(setItems);
  }, [authStatus]);

  useEffect(() => {
    return subscribe("notification:new", (event) => {
      const payload = event.payload as { title: string; body: string; data?: Record<string, unknown> };
      setItems((prev) => [
        {
          id: event.eventId,
          type: "info",
          title: payload.title,
          body: payload.body,
          data: payload.data,
          readAt: null,
          createdAt: event.timestamp,
        },
        ...prev,
      ]);
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

  return <AppShell title="Notifications" subtitle="Stay up to date with your workspace.">
    <div className="page narrow">
      <section className="card notification-card">
        <div className="card-head">
          <div><h3>All notifications</h3><p>{unreadCount} unread updates</p></div>
          <div style={{ display: "flex", gap: 8 }}>
            {pushState !== "unsupported" && <button className="plain" onClick={enablePush} disabled={pushState === "enabling" || pushState === "enabled"}>
              <BellRing size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
              {pushState === "enabled" ? "Push enabled" : pushState === "enabling" ? "Enabling…" : "Enable push"}
            </button>}
            <button className="plain" onClick={() => setItems(items.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })))}>Mark all as read</button>
          </div>
        </div>
        {items.length === 0 && <p className="quiet" style={{ padding: 20 }}>No notifications yet.</p>}
        {items.map((n) => {
          const Icon = iconFor(n);
          return <button className={`notification-row ${!n.readAt ? "unread" : ""}`} onClick={() => setItems(items.map((x) => (x.id === n.id ? { ...x, readAt: x.readAt ?? new Date().toISOString() } : x)))} key={n.id}>
            <span className="tiny-icon coral"><Icon/></span>
            <span><strong>{n.title}</strong><small>{n.body}</small></span>
            <time>{timeAgo(n.createdAt)}</time>
            {!n.readAt && <i/>}
          </button>;
        })}
      </section>
    </div>
  </AppShell>;
}
