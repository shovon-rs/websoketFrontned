"use client";
import { useEffect } from "react";
import { useWs } from "@/lib/ws-context";
import { playNotificationChime } from "@/lib/sound";

/** No UI — just plays a chime whenever a notification arrives, on whatever page the user is on. */
export function NotificationSoundListener() {
  const { subscribe } = useWs();

  useEffect(() => subscribe("notification:new", () => playNotificationChime()), [subscribe]);

  return null;
}
