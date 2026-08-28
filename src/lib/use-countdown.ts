"use client";
import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Second-granularity countdown to an ISO timestamp. setInterval, not requestAnimationFrame —
 * only text needs updating once a second, matching how this codebase already reaches for
 * setInterval for periodic UI refresh elsewhere (e.g. people/page.tsx's 15s poll).
 * Self-healing: reports isLive from the clock alone once the target has passed, without
 * waiting for a server push to confirm it.
 */
export function useCountdown(targetIso: string | null): { label: string; isLive: boolean } {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!targetIso) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [targetIso]);

  if (!targetIso) return { label: "", isLive: false };

  const remaining = new Date(targetIso).getTime() - now;
  if (remaining <= 0) return { label: "LIVE", isLive: true };
  return { label: `Starts in ${formatRemaining(remaining)}`, isLive: false };
}
