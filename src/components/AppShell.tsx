"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, LayoutDashboard, MapPin, MessageCircle, PanelsTopLeft, Phone, Search, Settings, Users, Zap } from "lucide-react";
import { Avatar } from "./Avatar";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard }, { href: "/chat", label: "Messages", icon: MessageCircle, badge: "3" },
  { href: "/notifications", label: "Notifications", icon: Bell, badge: "2" }, { href: "/tracking", label: "Live tracking", icon: MapPin },
  { href: "/collab/launch-plan", label: "Documents", icon: PanelsTopLeft }, { href: "/call/team-sync", label: "Calls", icon: Phone },
];

export function AppShell({ children, title, subtitle, actions }: { children: React.ReactNode; title: string; subtitle?: string; actions?: React.ReactNode }) {
  const path = usePathname();
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/dashboard"><span className="brand-mark"><Zap size={19} fill="currentColor" /></span><span>relay</span></Link>
      <nav className="nav"><p className="nav-label">Workspace</p>{nav.map(({ href, label, icon: Icon, badge }) => <Link key={href} href={href} className={path.startsWith(href.split("/").slice(0,2).join("/")) ? "active" : ""}><Icon size={19}/><span>{label}</span>{badge && <b>{badge}</b>}</Link>)}</nav>
      <div className="sidebar-bottom"><Link href="#"><Users size={19}/> Invite people</Link><Link href="#"><Settings size={19}/> Settings</Link><div className="user-card"><Avatar initials="AS" color="green" online/><div><strong>Alex Smith</strong><small>alex@relay.team</small></div><ChevronDown size={16}/></div></div>
    </aside>
    <main className="main"><header className="topbar"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className="top-actions"><button className="search-btn"><Search size={18}/><span>Search anything</span><kbd>⌘ K</kbd></button>{actions}<Link href="/notifications" className="icon-btn"><Bell size={19}/><i/></Link></div></header>{children}</main>
  </div>;
}
