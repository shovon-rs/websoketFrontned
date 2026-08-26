"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Bell, ChevronDown, LayoutDashboard, MapPin, MessageCircle, PanelsTopLeft, Phone, Search, Settings, Users, Zap } from "lucide-react";
import { Avatar } from "./Avatar";
import { useAuth } from "@/lib/auth-context";
import { useWs } from "@/lib/ws-context";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard }, { href: "/chat", label: "Messages", icon: MessageCircle },
  { href: "/notifications", label: "Notifications", icon: Bell }, { href: "/tracking", label: "Live tracking", icon: MapPin },
  { href: "/collab/launch-plan", label: "Documents", icon: PanelsTopLeft }, { href: "/call/team-sync", label: "Calls", icon: Phone },
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function AppShell({ children, title, subtitle, actions }: { children: React.ReactNode; title: string; subtitle?: string; actions?: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { status: authStatus, user, logout } = useAuth();
  const { status: wsStatus } = useWs();

  useEffect(() => {
    if (authStatus === "unauthenticated") router.replace("/login");
  }, [authStatus, router]);

  if (authStatus !== "authenticated" || !user) {
    return <div className="app-shell"><main className="main"><div className="page">Loading your workspace…</div></main></div>;
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/dashboard"><span className="brand-mark"><Zap size={19} fill="currentColor" /></span><span>relay</span></Link>
      <nav className="nav"><p className="nav-label">Workspace</p>{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={path.startsWith(href.split("/").slice(0,2).join("/")) ? "active" : ""}><Icon size={19}/><span>{label}</span></Link>)}</nav>
      <div className="sidebar-bottom"><Link href="#"><Users size={19}/> Invite people</Link><Link href="#"><Settings size={19}/> Settings</Link><button className="user-card" onClick={() => logout().then(() => router.replace("/login"))} title="Sign out"><Avatar initials={initialsOf(user.displayName)} color="green" online/><div><strong>{user.displayName}</strong><small>{user.email}</small></div><ChevronDown size={16}/></button></div>
    </aside>
    <main className="main"><header className="topbar"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className="top-actions">{wsStatus !== "connected" && <span className={`conn-pill ${wsStatus}`}><i/>{wsStatus === "reconnecting" ? "Reconnecting…" : wsStatus === "connecting" ? "Connecting…" : "Live updates unavailable"}</span>}<button className="search-btn"><Search size={18}/><span>Search anything</span><kbd>⌘ K</kbd></button>{actions}<Link href="/notifications" className="icon-btn"><Bell size={19}/></Link></div></header>{children}</main>
  </div>;
}
