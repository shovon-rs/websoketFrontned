"use client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useWs } from "@/lib/ws-context";
import { ApiError } from "@/lib/api-client";
import * as announcementsApi from "@/lib/api/announcements.api";
import * as liveRequestsApi from "@/lib/api/live-requests.api";
import { useCountdown } from "@/lib/use-countdown";
import type { Announcement, LiveStreamRequest, LiveStreamRequestStatus } from "@/lib/types";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const REQUEST_STATUS_LABEL: Record<LiveStreamRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Declined",
};

const REQUEST_STATUS_COLOR: Record<LiveStreamRequestStatus, string> = {
  pending: "#a26e29",
  approved: "#33845e",
  rejected: "#c23f2d",
};

function AnnouncementRow({ announcement }: { announcement: Announcement }) {
  const router = useRouter();
  const { label, isLive } = useCountdown(announcement.scheduledAt);
  return (
    <div className="activity-row">
      <div>
        <strong>{announcement.title}</strong>
        <small>{announcement.body}</small>
      </div>
      <button
        className={isLive ? "primary small" : "plain"}
        disabled={!announcement.scheduledAt || !isLive}
        onClick={() => router.push(`/live/${announcement.id}`)}
      >
        {announcement.scheduledAt ? (isLive ? "Join" : label) : "Posted"}
      </button>
    </div>
  );
}

export default function LivePage() {
  const { status: authStatus } = useAuth();
  const { subscribe } = useWs();

  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [myRequests, setMyRequests] = useState<LiveStreamRequest[] | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [proposedAt, setProposedAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    announcementsApi.listAnnouncements().then(setAnnouncements);
    liveRequestsApi.listMyLiveStreamRequests().then(setMyRequests);
  }, [authStatus]);

  useEffect(
    () =>
      subscribe("announcement:new", (event) => {
        const incoming = event.payload as Announcement;
        setAnnouncements((prev) =>
          prev?.some((a) => a.id === incoming.id)
            ? prev.map((a) => (a.id === incoming.id ? incoming : a))
            : [incoming, ...(prev ?? [])],
        );
      }),
    [subscribe],
  );

  useEffect(
    () =>
      subscribe("announcement:live", (event) => {
        const incoming = event.payload as Announcement;
        setAnnouncements((prev) => prev?.map((a) => (a.id === incoming.id ? incoming : a)) ?? prev);
      }),
    [subscribe],
  );

  useEffect(
    () =>
      subscribe("livestream-request:decided", (event) => {
        const incoming = event.payload as LiveStreamRequest;
        setMyRequests((prev) => prev?.map((r) => (r.id === incoming.id ? incoming : r)) ?? prev);
      }),
    [subscribe],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const created = await liveRequestsApi.createLiveStreamRequest({
        title: title.trim(),
        description: description.trim(),
        proposedAt: proposedAt ? new Date(proposedAt).toISOString() : null,
      });
      setMyRequests((prev) => [created, ...(prev ?? [])]);
      setTitle("");
      setDescription("");
      setProposedAt("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Live" subtitle="Upcoming events and live streams across the workspace.">
      <div className="page narrow">
        <section className="card" style={{ marginBottom: 20 }}>
          <div className="card-head"><div><h3>Upcoming & live</h3><p>Events you&rsquo;re eligible to see</p></div></div>
          {announcements === null && <p className="quiet">Loading…</p>}
          {announcements?.length === 0 && <p className="quiet">Nothing scheduled right now.</p>}
          {announcements?.map((a) => <AnnouncementRow announcement={a} key={a.id} />)}
        </section>

        <section className="card" style={{ marginBottom: 20 }}>
          <div className="card-head">
            <div><h3>Request to go live</h3><p>Ask a super admin for approval to start a live stream.</p></div>
          </div>
          <form className="settings-form" onSubmit={onSubmit}>
            <label>
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
            </label>
            <label>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={3}
                required
                style={{ width: "100%", marginTop: 7, padding: 12, border: "1px solid #dfe3df", borderRadius: 8, font: "inherit" }}
              />
            </label>
            <label>
              Proposed time (optional)
              <input type="datetime-local" value={proposedAt} onChange={(e) => setProposedAt(e.target.value)} />
            </label>
            {error && <p className="auth-error">{error}</p>}
            <div className="actions">
              <button className="primary" disabled={submitting || !title.trim() || !description.trim()}>
                {submitting ? "Sending…" : "Send request"}
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <div className="card-head"><div><h3>Your requests</h3></div></div>
          {myRequests === null && <p className="quiet">Loading…</p>}
          {myRequests?.length === 0 && <p className="quiet">You haven&rsquo;t requested to go live yet.</p>}
          {myRequests?.map((r) => (
            <div className="activity-row" key={r.id}>
              <div><strong>{r.title}</strong><small>{r.description}</small></div>
              <span style={{ fontSize: 10, fontWeight: 700, color: REQUEST_STATUS_COLOR[r.status] }}>
                {REQUEST_STATUS_LABEL[r.status]}
              </span>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
