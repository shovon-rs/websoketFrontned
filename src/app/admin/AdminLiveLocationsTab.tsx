"use client";
import { ApiError } from "@/lib/api-client";
import * as trackingApi from "@/lib/api/tracking.api";
import { TrackingMap, TrackingMapMarker } from "@/components/TrackingMap";
import { Avatar } from "@/components/Avatar";
import { fadeInUp, staggerContainer, staggerItem } from "@/lib/motion";
import { useWs } from "@/lib/ws-context";
import type { User } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const PALETTE = ["#e35e40", "#407ac1", "#745bca", "#bc7923", "#33845e"];
function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

interface LiveSession {
  sessionId: string;
  user: User;
  startedAt: string;
}

export function AdminLiveLocationsTab() {
  const { status: wsStatus, send, subscribe } = useWs();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Record<string, LiveSession>>({});
  const [positions, setPositions] = useState<Record<string, { lat: number; lng: number }>>({});
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    trackingApi
      .listAllActiveSessions()
      .then(({ sessions: active }) => {
        setSessions(
          Object.fromEntries(
            active.map((s) => [s.id, { sessionId: s.id, user: s.user, startedAt: s.startedAt }]),
          ),
        );
        setPositions((prev) => {
          const next = { ...prev };
          for (const s of active) {
            const last = s.locations[0];
            if (last) next[s.id] = { lat: last.lat, lng: last.lng };
          }
          return next;
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load live locations."))
      .finally(() => setLoading(false));
  }, []);

  // Room membership lives on the server connection — re-subscribe on every (re)connect.
  useEffect(() => {
    if (wsStatus !== "connected") return;
    send("tracking:admin:subscribe", {});
    return () => {
      send("tracking:admin:unsubscribe", {});
    };
  }, [wsStatus, send]);

  useEffect(() => {
    return subscribe("admin:tracking:started", (event) => {
      const payload = event.payload as { sessionId: string; userId: string; displayName: string; email: string; startedAt: string };
      setSessions((prev) => ({
        ...prev,
        [payload.sessionId]: {
          sessionId: payload.sessionId,
          user: { id: payload.userId, displayName: payload.displayName, email: payload.email } as User,
          startedAt: payload.startedAt,
        },
      }));
    });
  }, [subscribe]);

  useEffect(() => {
    return subscribe("admin:location:update", (event) => {
      const payload = event.payload as { sessionId: string; lat: number; lng: number };
      setPositions((prev) => ({ ...prev, [payload.sessionId]: { lat: payload.lat, lng: payload.lng } }));
    });
  }, [subscribe]);

  useEffect(() => {
    return subscribe("admin:tracking:stopped", (event) => {
      const payload = event.payload as { sessionId: string };
      setSessions((prev) => {
        const next = { ...prev };
        delete next[payload.sessionId];
        return next;
      });
      setPositions((prev) => {
        const next = { ...prev };
        delete next[payload.sessionId];
        return next;
      });
      setFocusId((prev) => (prev === payload.sessionId ? null : prev));
    });
  }, [subscribe]);

  const list = useMemo(() => Object.values(sessions), [sessions]);

  const markers = useMemo<TrackingMapMarker[]>(() => {
    return list
      .filter((s) => positions[s.sessionId])
      .map((s) => ({
        id: s.sessionId,
        lat: positions[s.sessionId].lat,
        lng: positions[s.sessionId].lng,
        label: s.user.displayName,
        color: colorFor(s.user.id),
      }));
  }, [list, positions]);

  return (
    <div className="admin-locations">
      <motion.div className="admin-locations-head" variants={fadeInUp} initial="hidden" animate="visible">
        <div>
          <span className="eyebrow">Super admin</span>
          <h2>Live locations</h2>
          <p className="quiet">Every user currently sharing their location, updated in real time.</p>
        </div>
        <span className="live-pill"><i className={markers.length > 0 ? "" : "dim"} /> {markers.length} of {list.length} live</span>
      </motion.div>

      {error && <p className="auth-error" role="alert">{error}</p>}

      <div className="tracking-grid">
        <section className="map-card"><div className="map-overlay">
          <TrackingMap markers={markers} focusId={focusId} />
          <div className="map-status">
            <i className={markers.length > 0 ? "pulse" : ""} />
            <strong>{markers.length > 0 ? "Live" : "No live positions yet"}</strong>
            <small>{markers.length} on map</small>
          </div>
        </div></section>

        <aside className="tracking-side">
          <section className="card admin-locations-list">
            <div className="card-head">
              <div>
                <h3>Sharing now</h3>
                <p>{list.length} active session{list.length === 1 ? "" : "s"}</p>
              </div>
            </div>

            {loading && <p className="quiet">Loading…</p>}

            {!loading && list.length === 0 && (
              <div className="empty-state">
                <MapPin size={22} />
                <p className="quiet">No one is currently sharing their location.</p>
              </div>
            )}

            {!loading && list.length > 0 && (
              <motion.div className="admin-locations-rows" variants={staggerContainer} initial="hidden" animate="visible">
                <AnimatePresence initial={false}>
                  {list.map((s) => {
                    const hasPosition = !!positions[s.sessionId];
                    const isSelected = focusId === s.sessionId;
                    return (
                      <motion.button
                        className={`activity-row selectable${isSelected ? " selected" : ""}`}
                        key={s.sessionId}
                        layout
                        variants={staggerItem}
                        exit={{ opacity: 0, x: 12, transition: { duration: 0.15 } }}
                        onClick={() => setFocusId(s.sessionId)}
                      >
                        <Avatar initials={s.user.displayName.slice(0, 2).toUpperCase()} color="blue" online={hasPosition} size="sm" />
                        <div>
                          <strong>{s.user.displayName}</strong>
                          <small>{hasPosition ? "Live" : "Waiting for location…"}</small>
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
