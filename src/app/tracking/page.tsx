"use client";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Clock, LocateFixed, MapPin, Navigation, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useWs } from "@/lib/ws-context";

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

export default function Tracking() {
  const { user } = useAuth();
  const { status: wsStatus, send, subscribe } = useWs();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [distanceKm, setDistanceKm] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => subscribe("tracking:started", (event) => setSessionId((event.payload as { sessionId: string }).sessionId)), [subscribe]);

  // Rejoin the session room after a reconnect so this tab keeps receiving broadcasts.
  useEffect(() => {
    if (wsStatus === "connected" && sessionId) send("tracking:join", { sessionId });
  }, [wsStatus, sessionId, send]);

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
    if (sessionId) send("tracking:stop", { sessionId });
    setActive(false);
    setSessionId(null);
    setDistanceKm(0);
    setStartedAt(null);
    lastPointRef.current = null;
  }, [sessionId, send, stopWatch]);

  useEffect(() => () => stopWatch(), [stopWatch]);

  const durationMs = startedAt ? now - startedAt : 0;

  return <AppShell title="Live tracking" subtitle="Share progress and location with your team.">
    <div className="page tracking-grid">
      <section className="map-card"><div className="fake-map">
        <span className="road r1"/><span className="road r2"/><span className="road r3"/><span className="water"/>
        <div className="map-marker"><MapPin fill="currentColor"/></div>
        {active && <span className="route"/>}
        <button className="locate"><LocateFixed/></button>
        <div className="map-status"><i className={active ? "pulse" : ""}/><strong>{active ? "Tracking live" : "Tracking paused"}</strong><small>{active ? "Updating every few seconds" : "Start sharing to begin"}</small></div>
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
        </section>
        <section className="privacy"><ShieldCheck/><div><strong>Your privacy matters</strong><p>Only invited team members can view this location. History is removed after 30 days, and you can delete it at any time.</p></div></section>
      </aside>
    </div>
  </AppShell>;
}
