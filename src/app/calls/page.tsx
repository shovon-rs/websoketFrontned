"use client";
import { AppShell } from "@/components/AppShell";
import { ListShimmer } from "@/components/Shimmer";
import { Avatar } from "@/components/Avatar";
import { Phone, PhoneCall, PhoneIncoming, PhoneMissed, PhoneOutgoing, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import * as callsApi from "@/lib/api/calls.api";
import { staggerContainer, staggerItem } from "@/lib/motion";
import type { CallHistoryEntry, CallStatus } from "@/lib/types";

function initialsOf(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function formatDuration(startedAt: string | null, endedAt: string | null): string | null {
  if (!startedAt || !endedAt) return null;
  const totalSeconds = Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return isToday ? `Today, ${time}` : `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}

const STATUS_LABEL: Record<CallStatus, string> = {
  ringing: "No answer",
  active: "Ongoing",
  ended: "Ended",
  missed: "Missed",
  rejected: "Declined",
};

export default function CallHistory() {
  const { status: authStatus, user } = useAuth();
  const [calls, setCalls] = useState<CallHistoryEntry[] | null>(null);

  // AppShell redirects to /login when unauthenticated, but it still renders this component's
  // effects on the way there — wait for a real session so we don't fire a doomed request.
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    callsApi.listCalls().then(setCalls);
  }, [authStatus]);

  if (!calls) return <AppShell title="Calls"><div className="page narrow"><section className="card"><ListShimmer rows={5}/></section></div></AppShell>;

  return <AppShell title="Calls" subtitle="Your full call history.">
    <div className="page narrow">
      <section className="card">
        <div className="card-head"><div><h3>All calls — {calls.length}</h3><p>Most recent first</p></div></div>
        {calls.length === 0 && (
          <div className="empty-state">
            <PhoneCall size={26} />
            <p className="quiet">No calls yet. Start one from the Calls page.</p>
          </div>
        )}
        <motion.div variants={staggerContainer} initial="hidden" animate="visible">
          {calls.map((call) => {
            const other = call.participants.find((p) => p.userId !== user?.id)?.user;
            const outgoing = call.initiatorId === user?.id;
            const duration = formatDuration(call.startedAt, call.endedAt);
            const missedLike = call.status === "ringing" || call.status === "missed" || call.status === "rejected";
            const DirectionIcon = missedLike && !outgoing ? PhoneMissed : outgoing ? PhoneOutgoing : PhoneIncoming;

            return <motion.div className="activity-row call-row" variants={staggerItem} key={call.id}>
              <Avatar initials={other ? initialsOf(other.displayName) : "?"} color="blue" src={other?.avatarUrl} size="sm" />
              <div>
                <strong>{other?.displayName ?? "Unknown"}</strong>
                <small style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <DirectionIcon size={11} className="call-direction-icon" style={{ color: missedLike ? "#d94f42" : undefined }} />
                  {call.type === "video" ? <Video size={11} /> : <Phone size={11} />}
                  {STATUS_LABEL[call.status]}{duration ? ` · ${duration}` : ""}
                </small>
              </div>
              <time>{formatWhen(call.createdAt)}</time>
            </motion.div>;
          })}
        </motion.div>
      </section>
    </div>
  </AppShell>;
}
