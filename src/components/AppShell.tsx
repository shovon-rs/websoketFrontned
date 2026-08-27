"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, LayoutDashboard, MapPin, MessageCircle, PanelsTopLeft, Phone, Search, Settings, Users, Zap } from "lucide-react";
import { Avatar } from "./Avatar";
import { useAuth } from "@/lib/auth-context";
import { useWs } from "@/lib/ws-context";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard }, { href: "/chat", label: "Messages", icon: MessageCircle },
  { href: "/people", label: "People", icon: Users },
  { href: "/notifications", label: "Notifications", icon: Bell }, { href: "/tracking", label: "Live tracking", icon: MapPin },
  { href: "/collab/launch-plan", label: "Documents", icon: PanelsTopLeft }, { href: "/call/team-sync", label: "Calls", icon: Phone },
];

const searchablePages = [
  ...nav.map((item) => ({ ...item, keywords: item.label })),
  { href: "/settings", label: "Settings", icon: Settings, keywords: "profile account name photo" },
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return searchablePages;
    return searchablePages.filter((item) => `${item.label} ${item.keywords}`.toLocaleLowerCase().includes(query));
  }, [searchQuery]);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.replace("/login");
  }, [authStatus, router]);

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
      if (event.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    setSearchQuery("");
    setHighlighted(0);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [searchOpen]);

  function goToSearchResult(href: string) {
    setSearchOpen(false);
    router.push(href);
  }

  if (authStatus !== "authenticated" || !user) {
    return <div className="app-shell"><main className="main"><div className="page">Loading your workspace…</div></main></div>;
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/dashboard"><span className="brand-mark"><Zap size={19} fill="currentColor" /></span><span>relay</span></Link>
      <nav className="nav"><p className="nav-label">Workspace</p>{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={path.startsWith(href.split("/").slice(0,2).join("/")) ? "active" : ""}><Icon size={19}/><span>{label}</span></Link>)}</nav>
      <div className="sidebar-bottom"><Link href="#"><Users size={19}/> Invite people</Link><Link href="/settings" className={path.startsWith("/settings") ? "active" : ""}><Settings size={19}/> Settings</Link><button className="user-card" onClick={() => logout().then(() => router.replace("/login"))} title="Sign out"><Avatar initials={initialsOf(user.displayName)} color="green" online src={user.avatarUrl}/><div><strong>{user.displayName}</strong><small>{user.email}</small></div><ChevronDown size={16}/></button></div>
    </aside>
    <main className="main"><header className="topbar"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className="top-actions">{wsStatus !== "connected" && <span className={`conn-pill ${wsStatus}`}><i/>{wsStatus === "reconnecting" ? "Reconnecting…" : wsStatus === "connecting" ? "Connecting…" : "Live updates unavailable"}</span>}<button className="search-btn" onClick={() => setSearchOpen(true)} aria-label="Search workspace"><Search size={18}/><span>Search anything</span><kbd>Ctrl K</kbd></button>{actions}<Link href="/notifications" className="icon-btn"><Bell size={19}/></Link></div></header>{children}</main>
    {searchOpen && <div className="global-search-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}>
      <section className="global-search" role="dialog" aria-modal="true" aria-label="Search workspace">
        <div className="global-search-input"><Search size={19}/><input ref={searchInputRef} value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setHighlighted(0); }} onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); setHighlighted((index) => Math.min(index + 1, searchResults.length - 1)); }
          if (event.key === "ArrowUp") { event.preventDefault(); setHighlighted((index) => Math.max(index - 1, 0)); }
          if (event.key === "Enter" && searchResults[highlighted]) { event.preventDefault(); goToSearchResult(searchResults[highlighted].href); }
        }} placeholder="Search pages and features…" role="combobox" aria-expanded="true" aria-controls="global-search-results" aria-activedescendant={searchResults[highlighted] ? `global-search-result-${highlighted}` : undefined}/><button onClick={() => setSearchOpen(false)} aria-label="Close search">Esc</button></div>
        <div className="global-search-results" id="global-search-results" role="listbox">
          {searchResults.map(({ href, label, icon: Icon }, index) => <button id={`global-search-result-${index}`} role="option" aria-selected={highlighted === index} className={highlighted === index ? "highlighted" : ""} key={href} onMouseEnter={() => setHighlighted(index)} onClick={() => goToSearchResult(href)}><Icon size={18}/><span>{label}</span><small>{href}</small></button>)}
          {searchResults.length === 0 && <p>No matching pages or features.</p>}
        </div>
        <footer><span>↑↓ Navigate</span><span>Enter Open</span><span>Esc Close</span></footer>
      </section>
    </div>}
  </div>;
}
