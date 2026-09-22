"use client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { fadeIn } from "@/lib/motion";
import { isAdmin, isSuperAdmin } from "@/lib/roles";
import { AnimatePresence, motion } from "framer-motion";
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
      <div className={tab === "live-locations" ? "page" : tab === "users" ? "page admin-page" : "page narrow"}>
        <div className="admin-tabs" role="tablist" aria-label="Admin sections">
          <button role="tab" aria-selected={tab === "users"} className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>Users</button>
          {canManageAnnouncements && (
            <button role="tab" aria-selected={tab === "announcements"} className={tab === "announcements" ? "active" : ""} onClick={() => setTab("announcements")}>
              Announcements
            </button>
          )}
          {canManageAnnouncements && (
            <button role="tab" aria-selected={tab === "live-requests"} className={tab === "live-requests" ? "active" : ""} onClick={() => setTab("live-requests")}>
              Live requests
            </button>
          )}
          {canManageAnnouncements && (
            <button role="tab" aria-selected={tab === "live-locations"} className={tab === "live-locations" ? "active" : ""} onClick={() => setTab("live-locations")}>
              Live locations
            </button>
          )}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} variants={fadeIn} initial="hidden" animate="visible" exit={{ opacity: 0, transition: { duration: 0.12 } }}>
            {tab === "users" && <AdminUsersTab actingRole={actingRole} currentUserId={user.id} />}
            {tab === "announcements" && canManageAnnouncements && <AdminAnnouncementsTab />}
            {tab === "live-requests" && canManageAnnouncements && <AdminLiveRequestsTab />}
            {tab === "live-locations" && canManageAnnouncements && <AdminLiveLocationsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
