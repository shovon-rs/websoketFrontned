"use client";
import { Avatar } from "@/components/Avatar";
import { UserMultiSelect } from "@/components/UserMultiSelect";
import { ApiError } from "@/lib/api-client";
import * as chatApi from "@/lib/api/chat.api";
import { dialogBackdrop, dialogPanel } from "@/lib/motion";
import { motion } from "framer-motion";
import type { Conversation, User } from "@/lib/types";
import { LogOut, X } from "lucide-react";
import { useState } from "react";

function initialsOf(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function GroupInfoDialog({
  conversation,
  currentUserId,
  onClose,
  onUpdated,
  onLeft,
}: {
  conversation: Conversation;
  currentUserId: string;
  onClose: () => void;
  onUpdated: (conversation: Conversation) => void;
  onLeft: () => void;
}) {
  const isAdmin = conversation.members.some((m) => m.userId === currentUserId && m.role === "admin");
  const [name, setName] = useState(conversation.name ?? "");
  const [renaming, setRenaming] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);
  const [newMembers, setNewMembers] = useState<User[]>([]);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSaveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === conversation.name) return;
    setError(null);
    setRenaming(true);
    try {
      const updated = await chatApi.renameConversation(conversation.id, trimmed);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rename the group.");
    } finally {
      setRenaming(false);
    }
  }

  async function onAddMembers() {
    if (newMembers.length === 0) return;
    setError(null);
    setAddingMembers(true);
    try {
      const updated = await chatApi.addMembers(conversation.id, newMembers.map((m) => m.id));
      onUpdated(updated);
      setNewMembers([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add those members.");
    } finally {
      setAddingMembers(false);
    }
  }

  async function onToggleRole(userId: string, targetRole: "admin" | "member") {
    setError(null);
    setPendingUserId(userId);
    try {
      await chatApi.updateMemberRole(conversation.id, userId, targetRole);
      onUpdated({
        ...conversation,
        members: conversation.members.map((m) => (m.userId === userId ? { ...m, role: targetRole } : m)),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change that member's role.");
    } finally {
      setPendingUserId(null);
    }
  }

  async function onRemoveMember(userId: string) {
    setError(null);
    setPendingUserId(userId);
    try {
      const { promotedAdminId } = await chatApi.removeMember(conversation.id, userId);
      if (userId === currentUserId) {
        onLeft();
        return;
      }
      onUpdated({
        ...conversation,
        members: conversation.members
          .filter((m) => m.userId !== userId)
          .map((m) => (m.userId === promotedAdminId ? { ...m, role: "admin" } : m)),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove that member.");
    } finally {
      setPendingUserId(null);
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
        aria-labelledby="group-info-title"
        variants={dialogPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <header>
          <div>
            <h2 id="group-info-title">Group info</h2>
            <p>{conversation.members.length} members</p>
          </div>
          <button onClick={onClose} aria-label="Close group info">
            <X size={18} />
          </button>
        </header>

        <label>
          Group name
          <div style={{ display: "flex", gap: 8, marginTop: 7 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              disabled={!isAdmin}
              style={{ flex: 1 }}
            />
            {isAdmin && (
              <button
                type="button"
                className="plain"
                onClick={onSaveName}
                disabled={renaming || !name.trim() || name.trim() === conversation.name}
              >
                {renaming ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </label>

        {error && <p className="share-error" role="alert">{error}</p>}

        <div style={{ marginTop: 16 }}>
          {conversation.members.map((m) => {
            const isSelf = m.userId === currentUserId;
            return (
              <div className="activity-row" key={m.id}>
                <Avatar initials={initialsOf(m.user.displayName)} color="blue" size="sm" />
                <div>
                  <strong>{m.user.displayName}{isSelf ? " (you)" : ""}</strong>
                  <small>{m.user.email}</small>
                </div>
                {m.role === "admin" && <span className="member-role-badge">Admin</span>}
                {isAdmin && !isSelf && (
                  <>
                    <button
                      className="plain"
                      disabled={pendingUserId === m.userId}
                      onClick={() => onToggleRole(m.userId, m.role === "admin" ? "member" : "admin")}
                    >
                      {m.role === "admin" ? "Remove admin" : "Make admin"}
                    </button>
                    <button
                      className="danger small"
                      disabled={pendingUserId === m.userId}
                      onClick={() => onRemoveMember(m.userId)}
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {isAdmin && (
          <div style={{ marginTop: 16 }}>
            <label>
              Add members
              <div style={{ marginTop: 7 }}>
                <UserMultiSelect selected={newMembers} onChange={setNewMembers} placeholder="Search by name or email…" />
              </div>
            </label>
            <button
              className="primary"
              style={{ marginTop: 10 }}
              disabled={newMembers.length === 0 || addingMembers}
              onClick={onAddMembers}
            >
              {addingMembers ? "Adding…" : "Add to group"}
            </button>
          </div>
        )}

        <button
          type="button"
          className="danger small"
          style={{ marginTop: 20 }}
          disabled={pendingUserId === currentUserId}
          onClick={() => onRemoveMember(currentUserId)}
        >
          <LogOut size={14} /> Leave group
        </button>
      </motion.section>
    </motion.div>
  );
}
