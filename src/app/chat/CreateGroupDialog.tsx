"use client";
import { ApiError } from "@/lib/api-client";
import * as chatApi from "@/lib/api/chat.api";
import { UserMultiSelect } from "@/components/UserMultiSelect";
import { dialogBackdrop, dialogPanel } from "@/lib/motion";
import { motion } from "framer-motion";
import type { Conversation, User } from "@/lib/types";
import { X } from "lucide-react";
import { useState } from "react";

export function CreateGroupDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (conversation: Conversation) => void;
}) {
  const [members, setMembers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (members.length === 0) {
      setError("Add at least one other person to the group.");
      return;
    }

    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();

    setSubmitting(true);
    try {
      const conversation = await chatApi.createConversation({
        type: "group",
        name,
        memberIds: members.map((m) => m.id),
      });
      onCreated(conversation);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the group. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      className="share-backdrop"
      variants={dialogBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <motion.section
        className="share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-group-title"
        variants={dialogPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <header>
          <div>
            <h2 id="create-group-title">New group</h2>
            <p>You'll be the group's admin — you can add or remove people and rename it later.</p>
          </div>
          <button onClick={onClose} aria-label="Close create group dialog">
            <X size={18} />
          </button>
        </header>
        <form onSubmit={onSubmit}>
          <label>
            Group name
            <input name="name" placeholder="e.g. Launch Squad" required maxLength={120} autoFocus />
          </label>
          <label>
            Members
            <div style={{ marginTop: 7 }}>
              <UserMultiSelect selected={members} onChange={setMembers} placeholder="Search by name or email…" />
            </div>
          </label>
          {error && <p className="share-error" role="alert">{error}</p>}
          <button className="primary wide" disabled={submitting}>
            {submitting ? "Creating…" : "Create group"}
          </button>
        </form>
      </motion.section>
    </motion.div>
  );
}
