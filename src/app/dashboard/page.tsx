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
  const [conversationCount, setConversationCount] = useState<number | null>(null);
  const [callsThisWeek, setCallsThisWeek] = useState<number | null>(null);
  const [chartData, setChartData] = useState<{ date: string; count: number }[] | null>(null);

  // AppShell redirects to /login when unauthenticated, but it still renders this component's
  // effects on the way there — wait for a real session so we don't fire a doomed request.
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    dashboardApi.getSummary().then((summary) => {
      setMetrics({ activeConnections: summary.activeConnections, onlineUsers: summary.activeConnections, generatedAt: summary.generatedAt });
      setConversationCount(summary.conversationCount);
      setCallsThisWeek(summary.callsThisWeek);
    });
    dashboardApi.getMessageActivity().then(setChartData);
  }, [authStatus]);

  // Re-join on every (re)connect — room membership lives on the server connection, not the client.
  useEffect(() => {
    if (wsStatus === "connected") send("dashboard:join", {});
  }, [wsStatus, send]);

  useEffect(() => subscribe("dashboard:metrics", (event) => setMetrics(event.payload as DashboardMetrics)), [subscribe]);

  const firstName = user?.displayName?.split(" ")[0] ?? "there";
  const totalMessages = chartData?.reduce((sum, d) => sum + d.count, 0) ?? null;

  return <AppShell title={`Good to see you, ${firstName}`} subtitle="Here’s what’s happening across your workspace."><div className="page dashboard-page">
    <div className="welcome"><div><span className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span><h2>Keep the momentum going.</h2><p>Live workspace activity updates automatically — no refresh needed.</p></div><Link href="/chat" className="primary"><Plus size={18}/> Start a conversation</Link></div>
    <section className="metric-grid">
      <Link href="/chat" className="metric"><span className="metric-icon coral"><MessageCircle/></span><div><small>Your conversations</small><strong>{conversationCount ?? "—"}</strong><em>See Messages</em></div></Link>
      <Link href="/people" className="metric"><span className="metric-icon blue"><Users/></span><div><small>Online now</small><strong>{metrics?.onlineUsers ?? "—"}</strong><em>See who's online</em></div></Link>
      <Link href="/calls" className="metric"><span className="metric-icon violet"><Phone/></span><div><small>Calls this week</small><strong>{callsThisWeek ?? "—"}</strong><em>See call history</em></div></Link>
      <div className="metric"><span className="metric-icon green"><Radio/></span><div><small>Connection</small><strong className="status-word">{wsStatus === "connected" ? "Live" : wsStatus === "reconnecting" ? "Reconnecting" : "Offline"}</strong><em><i className={wsStatus === "connected" ? "pulse" : ""}/> {metrics ? new Date(metrics.generatedAt).toLocaleTimeString() : ""}</em></div></div>
    </section>
    <div className="dashboard-grid">
      <section className="card activity-chart"><div className="card-head"><div><h3>Message activity</h3><p>{totalMessages !== null ? `${totalMessages} messages across your conversations, last 7 days` : "Loading…"}</p></div></div>{chartData ? <Chart data={chartData}/> : <p className="quiet">Loading message activity…</p>}</section>
      <section className="card live-now"><div className="card-head"><div><h3>Live now</h3><p>Active connections across the workspace</p></div><span className="live-pill"><i/> {metrics?.activeConnections ?? 0} connections</span></div><div className="people-stack"><Avatar initials={user ? user.displayName.slice(0, 2).toUpperCase() : "?"} color="green" online src={user?.avatarUrl}/></div><p className="quiet">Updates every few seconds from the live dashboard channel.</p><Link className="text-link" href="/people">See who's online <ArrowUpRight size={16}/></Link></section>
    </div>
    <section className="card quick-actions"><div className="card-head"><div><h3>Quick actions</h3><p>Start something or jump back into your work</p></div></div>
      <div className="quick-actions-grid">
        <Link href="/chat"><span className="quick-action-icon coral"><MessageCircle/></span><span><strong>Messages</strong><small>Open your conversations</small></span><ArrowUpRight/></Link>
        <Link href="/call/team-sync"><span className="quick-action-icon violet"><Phone/></span><span><strong>Start a call</strong><small>Connect by audio or video</small></span><ArrowUpRight/></Link>
        <Link href="/collab/new"><span className="quick-action-icon blue"><FileText/></span><span><strong>Create document</strong><small>Collaborate in real time</small></span><ArrowUpRight/></Link>
        <Link href="/tracking"><span className="quick-action-icon green"><MapPin/></span><span><strong>Share location</strong><small>Start secure live tracking</small></span><ArrowUpRight/></Link>
      </div>
    </section>
  </div></AppShell>;
}
