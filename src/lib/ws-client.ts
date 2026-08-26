import { WS_URL } from "./config";
import { buildEnvelope } from "./ws-envelope";
import type { ConnectionStatus, WsEvent } from "./types";

type Handler = (event: WsEvent) => void;

const MAX_RECONNECT_DELAY_MS = 30_000;
const SEEN_EVENT_CACHE_SIZE = 500;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyDisconnected = false;
  private handlers = new Map<string, Set<Handler>>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private status: ConnectionStatus = "disconnected";
  private seenEventIds: string[] = [];
  private seenEventIdSet = new Set<string>();

  connect(token: string): void {
    this.token = token;
    this.manuallyDisconnected = false;
    this.open();
  }

  /** Updates the token used for future reconnects without tearing down a live connection. */
  updateToken(token: string): void {
    this.token = token;
  }

  disconnect(): void {
    this.manuallyDisconnected = true;
    this.token = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
    this.setStatus("disconnected");
  }

  send<T>(type: string, payload: T, eventId?: string): string {
    const envelope = buildEnvelope(type, payload, eventId);
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(envelope));
    }
    return envelope.eventId;
  }

  on(type: string, handler: Handler): () => void {
    const set = this.handlers.get(type) ?? new Set<Handler>();
    set.add(handler);
    this.handlers.set(type, set);
    return () => set.delete(handler);
  }

  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  private open(): void {
    if (!this.token) return;

    this.setStatus(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");
    const socket = new WebSocket(`${WS_URL}?token=${encodeURIComponent(this.token)}`);
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus("connected");
    };

    socket.onmessage = (event) => {
      let parsed: WsEvent;
      try {
        parsed = JSON.parse(event.data as string);
      } catch {
        return;
      }
      this.dispatch(parsed);
    };

    socket.onclose = () => {
      this.socket = null;
      if (this.manuallyDisconnected) return;
      this.setStatus("reconnecting");
      this.scheduleReconnect();
    };

    socket.onerror = () => {
      socket.close();
    };
  }

  private dispatch(event: WsEvent): void {
    // Dedup by eventId — reconnect catch-up or a retried send can redeliver the same event.
    if (this.seenEventIdSet.has(event.eventId)) return;
    this.seenEventIdSet.add(event.eventId);
    this.seenEventIds.push(event.eventId);
    if (this.seenEventIds.length > SEEN_EVENT_CACHE_SIZE) {
      const oldest = this.seenEventIds.shift();
      if (oldest) this.seenEventIdSet.delete(oldest);
    }

    this.handlers.get(event.type)?.forEach((handler) => handler(event));
    this.handlers.get("*")?.forEach((handler) => handler(event));
  }

  private scheduleReconnect(): void {
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, MAX_RECONNECT_DELAY_MS);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      if (!this.manuallyDisconnected && this.token) this.open();
    }, delay);
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }
}

export const wsClient = new WebSocketClient();
