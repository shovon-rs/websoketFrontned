"use client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { isAdmin, isSuperAdmin } from "@/lib/roles";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AdminUsersTab } from "./AdminUsersTab";
import { AdminAnnouncementsTab } from "./AdminAnnouncementsTab";
import { AdminLiveRequestsTab } from "./AdminLiveRequestsTab";
import { AdminLiveLocationsTab } from "./AdminLiveLocationsTab";

type Tab = "users" | "announcements" | "live-requests" | "live-locations";
const VALID_TABS: Tab[] = ["users", "announcements", "live-requests", "live-locations"];

export default function AdminPage() {
  return (
    // useSearchParams() (used to deep-link into a tab, e.g. /admin?tab=live-locations from
    // the dashboard's Connection card) opts this route out of static rendering unless the
    // part that calls it is wrapped in Suspense.
    <Suspense fallback={<AppShell title="Admin"><div className="page">Loading…</div></AppShell>}>
      <AdminPageContent />
    </Suspense>
  );
}

function AdminPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: authStatus, user } = useAuth();
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(
    VALID_TABS.includes(requestedTab as Tab) ? (requestedTab as Tab) : "users",
  );

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
      <div className={tab === "live-locations" ? "page" : "page narrow"}>
        <div className="admin-tabs">
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
          {canManageAnnouncements && (
            <button className={tab === "live-locations" ? "primary" : "plain"} onClick={() => setTab("live-locations")}>
              Live locations
            </button>
          )}
        </div>
        {tab === "users" && <AdminUsersTab actingRole={actingRole} currentUserId={user.id} />}
        {tab === "announcements" && canManageAnnouncements && <AdminAnnouncementsTab />}
        {tab === "live-requests" && canManageAnnouncements && <AdminLiveRequestsTab />}
        {tab === "live-locations" && canManageAnnouncements && <AdminLiveLocationsTab />}
      </div>
    </AppShell>
  );
}
