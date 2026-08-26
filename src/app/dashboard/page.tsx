"use client";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Chart } from "@/components/Chart";
import { ArrowUpRight, FileText, MapPin, MessageCircle, Phone, Plus, Radio, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useWs } from "@/lib/ws-context";
import * as dashboardApi from "@/lib/api/dashboard.api";
import type { DashboardMetrics } from "@/lib/types";

export default function Dashboard() {
  const { status: authStatus, user } = useAuth();
  const { status: wsStatus, send, subscribe } = useWs();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  // AppShell redirects to /login when unauthenticated, but it still renders this component's
  // effects on the way there — wait for a real session so we don't fire a doomed request.
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    dashboardApi.getSummary().then((summary) =>
      setMetrics({ activeConnections: summary.activeConnections, onlineUsers: summary.activeConnections, generatedAt: summary.generatedAt }),
    );
  }, [authStatus]);

  // Re-join on every (re)connect — room membership lives on the server connection, not the client.
  useEffect(() => {
    if (wsStatus === "connected") send("dashboard:join", {});
  }, [wsStatus, send]);

  useEffect(() => subscribe("dashboard:metrics", (event) => setMetrics(event.payload as DashboardMetrics)), [subscribe]);

  const firstName = user?.displayName?.split(" ")[0] ?? "there";

  return <AppShell title={`Good to see you, ${firstName}`} subtitle="Here’s what’s happening across your workspace."><div className="page dashboard-page">
    <div className="welcome"><div><span className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span><h2>Keep the momentum going.</h2><p>Live workspace activity updates automatically — no refresh needed.</p></div><Link href="/chat" className="primary"><Plus size={18}/> Start a conversation</Link></div>
    <section className="metric-grid">
      <div className="metric"><span className="metric-icon coral"><MessageCircle/></span><div><small>Your conversations</small><strong>—</strong><em>See Messages</em></div></div>
      <div className="metric"><span className="metric-icon blue"><Users/></span><div><small>Online now</small><strong>{metrics?.onlineUsers ?? "—"}</strong><em>live count</em></div></div>
      <div className="metric"><span className="metric-icon violet"><Phone/></span><div><small>Calls this week</small><strong>—</strong><em>not tracked yet</em></div></div>
      <div className="metric"><span className="metric-icon green"><Radio/></span><div><small>Connection</small><strong className="status-word">{wsStatus === "connected" ? "Live" : wsStatus === "reconnecting" ? "Reconnecting" : "Offline"}</strong><em><i className={wsStatus === "connected" ? "pulse" : ""}/> {metrics ? new Date(metrics.generatedAt).toLocaleTimeString() : ""}</em></div></div>
    </section>
    <div className="dashboard-grid">
      <section className="card activity-chart"><div className="card-head"><div><h3>Message activity</h3><p>Sample trend — connect analytics for real data</p></div></div><Chart/></section>
      <section className="card live-now"><div className="card-head"><div><h3>Live now</h3><p>Active connections across the workspace</p></div><span className="live-pill"><i/> {metrics?.activeConnections ?? 0} connections</span></div><div className="people-stack"><Avatar initials={user ? user.displayName.slice(0, 2).toUpperCase() : "?"} color="green" online/></div><p className="quiet">Updates every few seconds from the live dashboard channel.</p><Link className="text-link" href="/chat">View messages <ArrowUpRight size={16}/></Link></section>
    </div>
    <div className="dashboard-grid bottom">
      <section className="card recent"><div className="card-head"><div><h3>Quick actions</h3><p>Jump right back in</p></div></div>
        <Link href="/chat"><MessageCircle/><span><strong>Messages</strong><small>Open your conversations</small></span><ArrowUpRight/></Link>
        <Link href="/call/team-sync"><Phone/><span><strong>Start a call</strong><small>Audio or video</small></span><ArrowUpRight/></Link>
        <Link href="/collab/new"><FileText/><span><strong>Create document</strong><small>Collaborate in real time</small></span><ArrowUpRight/></Link>
        <Link href="/tracking"><MapPin/><span><strong>Share location</strong><small>Start live tracking</small></span><ArrowUpRight/></Link>
      </section>
      <section className="card quick"><div className="card-head"><div><h3>Quick actions</h3><p>Jump right back in</p></div></div></section>
    </div>
  </div></AppShell>;
}
