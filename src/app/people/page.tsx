"use client";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import * as usersApi from "@/lib/api/users.api";
import { formatLastSeen, formatOnlineDuration } from "@/lib/time";
import type { PresenceUser } from "@/lib/types";

const POLL_MS = 15000;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function People() {
  const { status: authStatus } = useAuth();
  const [users, setUsers] = useState<PresenceUser[] | null>(null);

  // AppShell redirects to /login when unauthenticated, but it still renders this component's
  // effects on the way there — wait for a real session so we don't fire a doomed request.
  useEffect(() => {
    if (authStatus !== "authenticated") return;

    let cancelled = false;
    function load() {
      usersApi.getPresence().then((list) => {
        if (!cancelled) setUsers(list);
      });
    }

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [authStatus]);

  if (!users) return <AppShell title="People"><div className="page">Loading…</div></AppShell>;

  const online = users.filter((u) => u.online);
  const offline = users.filter((u) => !u.online);

  return <AppShell title="People" subtitle="See who's around right now.">
    <div className="page narrow">
      <section className="card">
        <div className="card-head"><div><h3>Online — {online.length}</h3><p>Active right now</p></div></div>
        {online.length === 0 && <p className="quiet" style={{ padding: "10px 0" }}>No one else is online right now.</p>}
        {online.map((u) => <div className="activity-row" key={u.id}>
          <Avatar initials={initialsOf(u.displayName)} color="green" online src={u.avatarUrl} size="sm" />
          <div><strong>{u.displayName}</strong><small>{u.onlineSince ? formatOnlineDuration(u.onlineSince) : "Online"}</small></div>
        </div>)}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><div><h3>Offline</h3><p>Not currently connected</p></div></div>
        {offline.length === 0 && <p className="quiet" style={{ padding: "10px 0" }}>Everyone is online.</p>}
        {offline.map((u) => <div className="activity-row" key={u.id}>
          <Avatar initials={initialsOf(u.displayName)} color="blue" online={false} src={u.avatarUrl} size="sm" />
          <div><strong>{u.displayName}</strong><small>{formatLastSeen(u.lastSeenAt)}</small></div>
        </div>)}
      </section>
    </div>
  </AppShell>;
}
