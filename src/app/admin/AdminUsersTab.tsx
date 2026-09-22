"use client";
import { Avatar } from "@/components/Avatar";
import { PasswordField } from "@/components/PasswordField";
import { ListShimmer } from "@/components/Shimmer";
import { ApiError } from "@/lib/api-client";
import * as usersApi from "@/lib/api/users.api";
import { dialogBackdrop, dialogPanel, staggerContainer, staggerItem } from "@/lib/motion";
import { strongPasswordError } from "@/lib/password";
import { isSuperAdmin } from "@/lib/roles";
import type { Role, User } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

const ALL_ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "user", label: "User" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super admin" },
];

export function AdminUsersTab({ actingRole, currentUserId }: { actingRole: Role; currentUserId: string }) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  function loadUsers() {
    usersApi.listUsersForAdmin().then(setUsers).catch((err) => {
      setError(err instanceof ApiError ? err.message : "Could not load the user roster.");
    });
  }

  useEffect(loadUsers, []);

  async function onRoleChange(target: User, role: Role) {
    setError(null);
    setPendingId(target.id);
    try {
      const updated = await usersApi.updateUserRole(target.id, role);
      setUsers((prev) => prev?.map((u) => (u.id === target.id ? updated : u)) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change that user's role.");
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(target: User) {
    setError(null);
    setPendingId(target.id);
    try {
      await usersApi.deleteUser(target.id);
      setUsers((prev) => prev?.filter((u) => u.id !== target.id) ?? prev);
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete that user.");
    } finally {
      setPendingId(null);
    }
  }

  if (!users) return <section className="card"><ListShimmer rows={6} /></section>;

  return (
    <section className="card">
      <div className="card-head">
        <div><h3>All users — {users.length}</h3><p>Change a user's role below.</p></div>
        <button className="primary" onClick={() => setCreateOpen(true)}>
          <UserPlus size={16} /> Create user
        </button>
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <motion.div variants={staggerContainer} initial="hidden" animate="visible">
        {users.map((u) => {
          const isSelf = u.id === currentUserId;
          const targetIsSuperAdmin = u.role === "super_admin";
          // An admin (not super_admin) may never act on an existing super_admin row at all.
          const roleActionsDisabled = isSelf || pendingId === u.id || (targetIsSuperAdmin && actingRole !== "super_admin");
          // Deleting is reserved for super_admin, and a super_admin may never delete another super_admin.
          const canDelete = isSuperAdmin(actingRole) && !isSelf && !targetIsSuperAdmin;

          return (
            <motion.div className="activity-row row-hover" key={u.id} variants={staggerItem} layout>
              <Avatar initials={initialsOf(u.displayName)} color="blue" size="sm" src={u.avatarUrl} />
              <div>
                <strong>{u.displayName}{isSelf ? " (you)" : ""}</strong>
                <small>{u.email}</small>
              </div>
              <select
                className="role-select"
                value={u.role ?? "user"}
                disabled={roleActionsDisabled}
                onChange={(e) => onRoleChange(u, e.target.value as Role)}
              >
                {/* Granting super_admin is reserved for an existing super_admin — the option is
                    still listed (so a super_admin row always has a matching <option>) but
                    disabled as a *new* choice for a plain admin actor. */}
                {ALL_ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} disabled={o.value === "super_admin" && actingRole !== "super_admin"}>
                    {o.label}
                  </option>
                ))}
              </select>
              {canDelete && (
                <button
                  className="danger small"
                  disabled={pendingId === u.id}
                  onClick={() => setDeleteTarget(u)}
                  title={`Delete ${u.displayName}`}
                >
                  Delete
                </button>
              )}
            </motion.div>
          );
        })}
      </motion.div>

      <AnimatePresence>
        {createOpen && (
          <CreateUserDialog
            actingRole={actingRole}
            onClose={() => setCreateOpen(false)}
            onCreated={(created) => {
              setUsers((prev) => (prev ? [...prev, created] : prev));
              setCreateOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            className="share-backdrop"
            variants={dialogBackdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && pendingId !== deleteTarget.id) setDeleteTarget(null);
            }}
          >
            <motion.section
              className="share-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-user-title"
              variants={dialogPanel}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <header>
                <div>
                  <h2 id="delete-user-title">Delete user?</h2>
                  <p>&ldquo;{deleteTarget.displayName}&rdquo; will no longer be able to sign in. This cannot be undone.</p>
                </div>
                <button onClick={() => setDeleteTarget(null)} aria-label="Close delete confirmation" disabled={pendingId === deleteTarget.id}>
                  <X size={18} />
                </button>
              </header>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button className="plain wide" onClick={() => setDeleteTarget(null)} disabled={pendingId === deleteTarget.id}>
                  Cancel
                </button>
                <button className="danger wide" onClick={() => onDelete(deleteTarget)} disabled={pendingId === deleteTarget.id}>
                  {pendingId === deleteTarget.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function CreateUserDialog({
  actingRole,
  onClose,
  onCreated,
}: {
  actingRole: Role;
  onClose: () => void;
  onCreated: (user: User) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A plain admin may create up to admin — granting super_admin is reserved for an existing
  // super_admin, mirroring the same escalation rule the role dropdown above enforces.
  const assignableRoles = ALL_ROLE_OPTIONS.filter((o) => o.value !== "super_admin" || actingRole === "super_admin");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const displayName = String(form.get("displayName") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const role = String(form.get("role") ?? "user") as Role;

    const passwordError = strongPasswordError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setSubmitting(true);
    try {
      const created = await usersApi.createUser({ email, password, displayName, role });
      onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create that user. Please try again.");
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
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.section
        className="share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-user-title"
        variants={dialogPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <header>
          <div>
            <h2 id="create-user-title">Create user</h2>
            <p>They'll be asked to change this password the first time they sign in.</p>
          </div>
          <button onClick={onClose} aria-label="Close create user dialog">
            <X size={18} />
          </button>
        </header>
        <form onSubmit={onSubmit}>
          <label>
            Full name
            <input name="displayName" placeholder="Alex Smith" autoComplete="name" required />
          </label>
          <label>
            Email address
            <input name="email" type="email" placeholder="alex@company.com" autoComplete="email" required />
          </label>
          <label>
            Temporary password
            <PasswordField name="password" placeholder="At least 8 characters" minLength={8} autoComplete="new-password" required />
          </label>
          <label>
            Role
            <select name="role" defaultValue="user">
              {assignableRoles.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          {error && <p className="share-error" role="alert">{error}</p>}
          <button className="primary wide" disabled={submitting}>
            {submitting ? "Creating…" : "Create user"}
          </button>
        </form>
      </motion.section>
    </motion.div>
  );
}
