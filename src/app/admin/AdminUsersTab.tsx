"use client";
import { Avatar } from "@/components/Avatar";
import { ApiError } from "@/lib/api-client";
import * as usersApi from "@/lib/api/users.api";
import type { Role, User } from "@/lib/types";
import { useEffect, useState } from "react";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

const ALL_ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "user", label: "User" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super admin" },
];

export function AdminUsersTab({ actingRole, currentUserId }: { actingRole: Role; currentUserId: string }) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    usersApi.listUsersForAdmin().then(setUsers).catch((err) => {
      setError(err instanceof ApiError ? err.message : "Could not load the user roster.");
    });
  }, []);

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

  if (!users) return <section className="card"><p className="quiet">Loading users…</p></section>;

  return (
    <section className="card">
      <div className="card-head">
        <div><h3>All users — {users.length}</h3><p>Change a user's role below.</p></div>
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {users.map((u) => {
        const isSelf = u.id === currentUserId;
        const targetIsSuperAdmin = u.role === "super_admin";
        // An admin (not super_admin) may never act on an existing super_admin row at all.
        const disabled = isSelf || pendingId === u.id || (targetIsSuperAdmin && actingRole !== "super_admin");

        return (
          <div className="activity-row" key={u.id}>
            <Avatar initials={initialsOf(u.displayName)} color="blue" size="sm" src={u.avatarUrl} />
            <div>
              <strong>{u.displayName}{isSelf ? " (you)" : ""}</strong>
              <small>{u.email}</small>
            </div>
            <select
              className="role-select"
              value={u.role ?? "user"}
              disabled={disabled}
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
          </div>
        );
      })}
    </section>
  );
}
