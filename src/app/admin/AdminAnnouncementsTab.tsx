"use client";
import { UserMultiSelect } from "@/components/UserMultiSelect";
import { ListShimmer } from "@/components/Shimmer";
import { ApiError } from "@/lib/api-client";
import * as announcementsApi from "@/lib/api/announcements.api";
import { fadeInUp, staggerContainer, staggerItem, tapScale } from "@/lib/motion";
import type { Announcement, AnnouncementAudience, AnnouncementStatus, User } from "@/lib/types";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const STATUS_LABEL: Record<AnnouncementStatus, string> = {
  published: "Posted",
  scheduled: "Scheduled",
  live: "Live",
  ended: "Ended",
  cancelled: "Cancelled",
};

export function AdminAnnouncementsTab() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("everyone");
  const [invited, setInvited] = useState<User[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  function loadAnnouncements() {
    announcementsApi
      .listAnnouncements()
      .then(setAnnouncements)
      .catch((err) => setListError(err instanceof ApiError ? err.message : "Could not load announcements."));
  }

  useEffect(loadAnnouncements, []);

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && (audience === "everyone" || invited.length > 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await announcementsApi.createAnnouncement({
        title: title.trim(),
        body: body.trim(),
        audience,
        inviteUserIds: audience === "invited" ? invited.map((u) => u.id) : undefined,
      });
      setTitle("");
      setBody("");
      setAudience("everyone");
      setInvited([]);
      loadAnnouncements();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the announcement. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onCancel(id: string) {
    try {
      const updated = await announcementsApi.cancelAnnouncement(id);
      setAnnouncements((prev) => prev?.map((a) => (a.id === id ? updated : a)) ?? prev);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Could not cancel that announcement.");
    }
  }

  return (
    <>
      <motion.section className="card" style={{ marginBottom: 20 }} variants={fadeInUp} initial="hidden" animate="visible">
        <div className="card-head"><div><h3>New announcement</h3><p>Sent immediately as a notification.</p></div></div>
        <form className="settings-form" onSubmit={onSubmit}>
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
          </label>
          <label>
            Message
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              rows={4}
              required
              style={{ width: "100%", marginTop: 7, padding: 12, border: "1px solid #dfe3df", borderRadius: 8, font: "inherit" }}
            />
          </label>
          <div style={{ display: "flex", gap: 10, margin: "16px 0" }}>
            <button type="button" className={audience === "everyone" ? "primary" : "plain"} onClick={() => setAudience("everyone")}>
              Everyone
            </button>
            <button type="button" className={audience === "invited" ? "primary" : "plain"} onClick={() => setAudience("invited")}>
              Invited only
            </button>
          </div>
          {audience === "invited" && (
            <UserMultiSelect selected={invited} onChange={setInvited} placeholder="Search people to invite…" />
          )}
          {error && <p className="auth-error">{error}</p>}
          <div className="actions">
            <button className="primary" disabled={submitting || !canSubmit}>
              {submitting ? "Sending…" : "Send announcement"}
            </button>
          </div>
        </form>
      </motion.section>

      <motion.section className="card" variants={fadeInUp} initial="hidden" animate="visible" transition={{ delay: 0.08 }}>
        <div className="card-head"><div><h3>All announcements</h3><p>Most recent first</p></div></div>
        {listError && <p className="auth-error" role="alert">{listError}</p>}
        {announcements === null && <ListShimmer rows={3} />}
        {announcements?.length === 0 && <p className="quiet">No announcements yet.</p>}
        <motion.div variants={staggerContainer} initial="hidden" animate="visible">
          {announcements?.map((a) => (
            <motion.div className="activity-row row-hover" key={a.id} variants={staggerItem} layout>
              <div>
                <strong>{a.title}</strong>
                <small>{STATUS_LABEL[a.status]} · {a.audience === "everyone" ? "Everyone" : `${a.invitedUsers?.length ?? 0} invited`}</small>
              </div>
              {(a.status === "scheduled" || a.status === "live") && (
                <motion.button className="plain" whileTap={tapScale} onClick={() => onCancel(a.id)}>Cancel</motion.button>
              )}
            </motion.div>
          ))}
        </motion.div>
      </motion.section>
    </>
  );
}
