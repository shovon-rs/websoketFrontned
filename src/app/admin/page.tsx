"use client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { isAdmin, isSuperAdmin } from "@/lib/roles";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminUsersTab } from "./AdminUsersTab";
import { AdminAnnouncementsTab } from "./AdminAnnouncementsTab";
import { AdminLiveRequestsTab } from "./AdminLiveRequestsTab";

type Tab = "users" | "announcements" | "live-requests";

export default function AdminPage() {
  const router = useRouter();
  const { status: authStatus, user } = useAuth();
  const [tab, setTab] = useState<Tab>("users");

  useEffect(() => {
    if (authStatus === "authenticated" && !isAdmin(user?.role)) router.replace("/dashboard");
  }, [authStatus, user, router]);

  if (authStatus !== "authenticated" || !user || !isAdmin(user.role)) {
    return <AppShell title="Admin"><div className="page">Loading…</div></AppShell>;
  }

  const actingRole = user.role ?? "user";
  const canManageAnnouncements = isSuperAdmin(actingRole);

  return (
    <AppShell title="Admin" subtitle="Manage users, announcements, and live-stream requests.">
      <div className="page narrow">
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <button className={tab === "users" ? "primary" : "plain"} onClick={() => setTab("users")}>Users</button>
          {canManageAnnouncements && (
            <button className={tab === "announcements" ? "primary" : "plain"} onClick={() => setTab("announcements")}>
              Announcements
            </button>
          )}
          {canManageAnnouncements && (
            <button className={tab === "live-requests" ? "primary" : "plain"} onClick={() => setTab("live-requests")}>
              Live requests
            </button>
          )}
        </div>
        {tab === "users" && <AdminUsersTab actingRole={actingRole} currentUserId={user.id} />}
        {tab === "announcements" && canManageAnnouncements && <AdminAnnouncementsTab />}
        {tab === "live-requests" && canManageAnnouncements && <AdminLiveRequestsTab />}
      </div>
    </AppShell>
  );
}
