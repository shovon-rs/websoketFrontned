"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { wsClient } from "./ws-client";
import { useAuth } from "./auth-context";
import type { ConnectionStatus, WsEvent } from "./types";

interface WsContextValue {
  status: ConnectionStatus;
  send: <T>(type: string, payload: T, eventId?: string) => string;
  subscribe: (type: string, handler: (event: WsEvent) => void) => () => void;
}

const WsContext = createContext<WsContextValue | null>(null);

export function WsProvider({ children }: { children: React.ReactNode }) {
  const { status: authStatus, accessToken } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>(wsClient.getStatus());

  useEffect(() => wsClient.onStatusChange(setStatus), []);

  useEffect(() => {
    if (authStatus === "authenticated" && accessToken) {
      if (wsClient.getStatus() === "disconnected") {
        wsClient.connect(accessToken);
      } else {
        wsClient.updateToken(accessToken);
      }
    }
    if (authStatus === "unauthenticated") {
      wsClient.disconnect();
    }
  }, [authStatus, accessToken]);

  const value = useMemo<WsContextValue>(
    () => ({
      status,
      send: (type, payload, eventId) => wsClient.send(type, payload, eventId),
      subscribe: (type, handler) => wsClient.on(type, handler),
    }),
    [status],
  );

  return <WsContext.Provider value={value}>{children}</WsContext.Provider>;
}

export function useWs(): WsContextValue {
  const ctx = useContext(WsContext);
  if (!ctx) throw new Error("useWs must be used within a WsProvider");
  return ctx;
}
