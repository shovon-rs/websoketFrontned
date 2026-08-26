import type { WsEvent } from "./types";

export function makeEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function buildEnvelope<T>(type: string, payload: T, eventId = makeEventId()): WsEvent<T> {
  return { type, eventId, timestamp: new Date().toISOString(), payload };
}
