"use client";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { UserSearchDropdown } from "@/components/UserSearchDropdown";
import { TrackingMap, TrackingMapMarker } from "@/components/TrackingMap";
import { Clock, LocateFixed, Navigation, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useWs } from "@/lib/ws-context";
import * as trackingApi from "@/lib/api/tracking.api";
import type { User } from "@/lib/types";

const PALETTE = ["#e35e40", "#407ac1", "#745bca", "#bc7923", "#33845e"];
function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return minutes > 0 ? `${minutes} min` : `${seconds}s`;
}

interface SharedSession {
  sessionId: string;
  owner: User;
}

export default function Tracking() {
  const { status: authStatus, user } = useAuth();
  const { status: wsStatus, send, subscribe } = useWs();

  // Your own session
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [distanceKm, setDistanceKm] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [viewers, setViewers] = useState<User[]>([]);
  const [shareError, setShareError] = useState<string | null>(null);

  // Sessions shared with you by teammates
  const [sharedSessions, setSharedSessions] = useState<SharedSession[]>([]);

  // Live positions, keyed by sessionId (your own session included once sharing starts)
  const [positions, setPositions] = useState<Record<string, { lat: number; lng: number }>>({});
  const [focusId, setFocusId] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastSentRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const startRequestedRef = useRef(false);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  // Load anything already in progress: your own active session (e.g. after a page refresh)
  // and any live sessions teammates are currently sharing with you.
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    trackingApi.listSessions().then(({ owned, shared }) => {
      const mine = owned[0];
      if (mine) {
        setSessionId(mine.id);
        setActive(true);
        setStartedAt(new Date(mine.startedAt).getTime());
        setViewers(mine.viewers.map((v) => v.user));
        const last = mine.locations[0];
        if (last) setPositions((prev) => ({ ...prev, [mine.id]: { lat: last.lat, lng: last.lng } }));
      }

      setSharedSessions(shared.map((s) => ({ sessionId: s.id, owner: s.user })));
      setPositions((prev) => {
        const next = { ...prev };
        for (const s of shared) {
          const last = s.locations[0];
          if (last) next[s.id] = { lat: last.lat, lng: last.lng };
        }
        return next;
      });
    });
  }, [authStatus]);

  // Room membership lives on the server connection, not the client — rejoin everything
  // (your own session's room and every shared session you're viewing) on every (re)connect.
  useEffect(() => {
    if (wsStatus !== "connected") return;
    if (sessionId) send("tracking:join", { sessionId });
    for (const s of sharedSessions) send("tracking:join", { sessionId: s.sessionId });
  }, [wsStatus, sessionId, sharedSessions, send]);

  useEffect(() => subscribe("tracking:started", (event) => setSessionId((event.payload as { sessionId: string }).sessionId)), [subscribe]);

  useEffect(() => {
    return subscribe("location:update", (event) => {
      const payload = event.payload as { sessionId: string; lat: number; lng: number };
      setPositions((prev) => ({ ...prev, [payload.sessionId]: { lat: payload.lat, lng: payload.lng } }));
    });
  }, [subscribe]);

  // A teammate stopped sharing — drop their marker and remove them from the list.
  useEffect(() => {
    return subscribe("tracking:stop", (event) => {
      const payload = event.payload as { sessionId: string };
      setSharedSessions((prev) => prev.filter((s) => s.sessionId !== payload.sessionId));
      setPositions((prev) => {
        const next = { ...prev };
        delete next[payload.sessionId];
        return next;
      });
      setFocusId((prev) => (prev === payload.sessionId ? null : prev));
    });
  }, [subscribe]);

  // Someone just shared their live location with you — pick it up without a manual refresh.
  useEffect(() => {
    return subscribe("notification:new", (event) => {
      const payload = event.payload as { data?: { kind?: string; sessionId?: string } };
      if (payload.data?.kind !== "tracking:shared") return;
      trackingApi.listSessions().then(({ shared }) => {
        setSharedSessions(shared.map((s) => ({ sessionId: s.id, owner: s.user })));
      });
    });
  }, [subscribe]);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
  }, []);

  const startSharing = useCallback(() => {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Geolocation is not supported in this browser.");
      return;
    }

    startRequestedRef.current = false;

    // Requesting the position triggers the browser's native permission prompt — our consent gate.
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (!startRequestedRef.current) {
          startRequestedRef.current = true;
          send("tracking:start", {});
          setActive(true);
          setStartedAt(Date.now());
        }

        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (lastPointRef.current) setDistanceKm((d) => d + haversineKm(lastPointRef.current!, point));
        lastPointRef.current = point;

        const nowTs = Date.now();
        if (sessionIdRef.current && nowTs - lastSentRef.current > 5000) {
          send("location:update", { sessionId: sessionIdRef.current, lat: point.lat, lng: point.lng });
          lastSentRef.current = nowTs;
        }
      },
      () => setError("Location permission was denied. Enable it in your browser settings to share your position."),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
  }, [send]);

  const stopSharing = useCallback(() => {
    stopWatch();
    if (sessionId) {
      send("tracking:stop", { sessionId });
      setPositions((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
    }
    setActive(false);
    setSessionId(null);
    setDistanceKm(0);
    setStartedAt(null);
    setViewers([]);
    lastPointRef.current = null;
  }, [sessionId, send, stopWatch]);

  useEffect(() => () => stopWatch(), [stopWatch]);

  async function shareWith(recipient: User) {
    if (!sessionId) return;
    setShareError(null);
    try {
      await trackingApi.addViewer(sessionId, recipient.id);
      setViewers((prev) => (prev.some((v) => v.id === recipient.id) ? prev : [...prev, recipient]));
    } catch {
      setShareError("Could not share your location with that person.");
    }
  }

  async function stopSharingWith(viewerId: string) {
    if (!sessionId) return;
    await trackingApi.removeViewer(sessionId, viewerId).catch(() => undefined);
    setViewers((prev) => prev.filter((v) => v.id !== viewerId));
  }

  const durationMs = startedAt ? now - startedAt : 0;

  const markers = useMemo<TrackingMapMarker[]>(() => {
    const list: TrackingMapMarker[] = [];
    if (sessionId && positions[sessionId] && user) {
      list.push({ id: sessionId, lat: positions[sessionId].lat, lng: positions[sessionId].lng, label: "You", color: "#33845e" });
    }
    for (const s of sharedSessions) {
      const pos = positions[s.sessionId];
      if (!pos) continue;
      list.push({ id: s.sessionId, lat: pos.lat, lng: pos.lng, label: s.owner.displayName, color: colorFor(s.owner.id) });
    }
    return list;
  }, [sessionId, sharedSessions, positions, user]);

  return <AppShell title="Live tracking" subtitle="Share progress and location with your team.">
    <div className="page tracking-grid">
      <section className="map-card"><div className="map-overlay">
        <TrackingMap markers={markers} focusId={focusId} />
        <button className="locate" onClick={() => setFocusId(sessionId)} title="Center on me"><LocateFixed/></button>
        <div className="map-status"><i className={active ? "pulse" : ""}/><strong>{active ? "Tracking live" : "Tracking paused"}</strong><small>{markers.length} live on map</small></div>
      </div></section>
      <aside className="tracking-side">
        <section className="card">
          <span className="eyebrow">{active ? "Active session" : "No active session"}</span>
          <h2>{user?.displayName ?? "Your"} location</h2>
          <p className="quiet">{startedAt ? `Started at ${new Date(startedAt).toLocaleTimeString()}` : "Not started"}</p>
          <div className="tracking-person"><Avatar initials={user ? user.displayName.slice(0, 2).toUpperCase() : "?"} color="green" online={active}/><span><strong>{user?.displayName ?? "You"}</strong><small>{active ? "Sharing precise location" : "Sharing paused"}</small></span></div>
          <div className="tracking-stats"><div><Navigation/><strong>{distanceKm.toFixed(1)} km</strong><small>Distance</small></div><div><Clock/><strong>{formatDuration(durationMs)}</strong><small>Duration</small></div></div>
          {error && <p className="auth-error">{error}</p>}
          <button className={active ? "danger wide" : "primary wide"} onClick={active ? stopSharing : startSharing}>{active ? "Stop sharing" : "Start sharing"}</button>

          {active && <div style={{ marginTop: 16 }}>
            <p className="quiet" style={{ marginBottom: 8 }}>Share your live location with</p>
            <UserSearchDropdown onSelect={shareWith} placeholder="Search people to share with…" />
            {shareError && <p className="auth-error" style={{ marginTop: 8 }}>{shareError}</p>}
            {viewers.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
              {viewers.map((v) => <div className="selected-recipient" key={v.id}>
                <Avatar initials={v.displayName.slice(0, 2).toUpperCase()} color="blue" size="sm"/>
                <div><strong>{v.displayName}</strong><small>{v.email}</small></div>
                <button onClick={() => stopSharingWith(v.id)}><X size={12} style={{ verticalAlign: "-2px", marginRight: 4 }}/>Remove</button>
              </div>)}
            </div>}
          </div>}
        </section>

        {sharedSessions.length > 0 && <section className="card">
          <div className="card-head"><div><h3>Shared with you</h3><p>Live locations from your team</p></div></div>
          {sharedSessions.map((s) => {
            const hasPosition = !!positions[s.sessionId];
            return <button className="activity-row" style={{ width: "100%", background: "transparent", border: 0, cursor: "pointer", textAlign: "left" }} key={s.sessionId} onClick={() => setFocusId(s.sessionId)}>
              <Avatar initials={s.owner.displayName.slice(0, 2).toUpperCase()} color="blue" online={hasPosition} size="sm"/>
              <div><strong>{s.owner.displayName}</strong><small>{hasPosition ? "Live" : "Waiting for location…"}</small></div>
            </button>;
          })}
        </section>}

        <section className="privacy"><ShieldCheck/><div><strong>Your privacy matters</strong><p>Only people you explicitly share with can see your location. History is removed after 30 days, and you can delete it at any time.</p></div></section>
      </aside>
    </div>
  </AppShell>;
}
