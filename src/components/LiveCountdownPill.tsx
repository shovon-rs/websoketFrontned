"use client";
import { Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as announcementsApi from "@/lib/api/announcements.api";
import { useWs } from "@/lib/ws-context";
import { useCountdown } from "@/lib/use-countdown";
import type { Announcement } from "@/lib/types";

export function LiveCountdownPill() {
  const router = useRouter();
  const { subscribe } = useWs();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    announcementsApi.getUpcomingAnnouncement().then(setAnnouncement);
  }, []);

  useEffect(() => {
    function onIncoming(event: { payload: unknown }) {
      const incoming = event.payload as Announcement;
      const incomingScheduledAt = incoming.scheduledAt;
      if (!incomingScheduledAt || incoming.status === "ended" || incoming.status === "cancelled") return;
      setAnnouncement((prev) => {
        if (!prev || !prev.scheduledAt) return incoming;
        return new Date(incomingScheduledAt).getTime() < new Date(prev.scheduledAt).getTime() ? incoming : prev;
      });
    }
    const offNew = subscribe("announcement:new", onIncoming);
    const offLive = subscribe("announcement:live", onIncoming);
    return () => {
      offNew();
      offLive();
    };
  }, [subscribe]);

  const { label, isLive } = useCountdown(announcement?.scheduledAt ?? null);

  if (!announcement) return null;

  return (
    <button
      className={`live-countdown-pill ${isLive ? "live" : ""}`}
      onClick={() => router.push(isLive ? `/live/${announcement.id}` : "/live")}
    >
      <Radio size={13} />
      {isLive ? "LIVE — Join" : label}
    </button>
  );
}
