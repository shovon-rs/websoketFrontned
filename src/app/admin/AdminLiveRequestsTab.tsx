"use client";
import { ApiError } from "@/lib/api-client";
import * as liveRequestsApi from "@/lib/api/live-requests.api";
import { useWs } from "@/lib/ws-context";
import type { LiveStreamRequest } from "@/lib/types";
import { useEffect, useState } from "react";

function toDatetimeLocal(iso: string | null): string {
  const date = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function AdminLiveRequestsTab() {
  const { subscribe } = useWs();
  const [requests, setRequests] = useState<LiveStreamRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");

  useEffect(() => {
    liveRequestsApi
      .listPendingLiveStreamRequests()
      .then(setRequests)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load live-stream requests."));
  }, []);

  useEffect(
    () =>
      subscribe("livestream-request:new", (event) => {
        const incoming = event.payload as LiveStreamRequest;
        setRequests((prev) => (prev?.some((r) => r.id === incoming.id) ? prev : [incoming, ...(prev ?? [])]));
      }),
    [subscribe],
  );

  function startApproving(request: LiveStreamRequest) {
    setApprovingId(request.id);
    setScheduledAt(toDatetimeLocal(request.proposedAt));
  }

  async function confirmApprove(request: LiveStreamRequest) {
    if (!scheduledAt) return;
    setError(null);
    try {
      await liveRequestsApi.approveLiveStreamRequest(request.id, new Date(scheduledAt).toISOString());
      setRequests((prev) => prev?.filter((r) => r.id !== request.id) ?? prev);
      setApprovingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not approve that request.");
    }
  }

  async function reject(request: LiveStreamRequest) {
    setError(null);
    try {
      await liveRequestsApi.rejectLiveStreamRequest(request.id);
      setRequests((prev) => prev?.filter((r) => r.id !== request.id) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not decline that request.");
    }
  }

  return (
    <section className="card">
      <div className="card-head"><div><h3>Live-stream requests</h3><p>Pending approval</p></div></div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {requests === null && <p className="quiet">Loading…</p>}
      {requests?.length === 0 && <p className="quiet">No pending requests.</p>}
      {requests?.map((r) => (
        <div className="activity-row" key={r.id} style={{ flexWrap: "wrap" }}>
          <div>
            <strong>{r.title}</strong>
            <small>{r.requester?.displayName ?? "Unknown"} · {r.description}</small>
          </div>
          {approvingId === r.id ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              <button className="primary small" onClick={() => confirmApprove(r)}>Confirm</button>
              <button className="plain" onClick={() => setApprovingId(null)}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="primary small" onClick={() => startApproving(r)}>Approve</button>
              <button className="plain" onClick={() => reject(r)}>Reject</button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
