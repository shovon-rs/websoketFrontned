"use client";
import { useAuth } from "@/lib/auth-context";
import { useWs } from "@/lib/ws-context";
import { hasRole } from "@/lib/roles";
import type { Role } from "@/lib/types";
import {
	Bell,
	Check,
	ChevronDown,
	Copy,
	LayoutDashboard,
	MapPin,
	MessageCircle,
	PanelsTopLeft,
	Phone,
	Radio,
	Search,
	Settings,
	Share2,
	ShieldCheck,
	Users,
	X,
	Zap,
	type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { LiveCountdownPill } from "./LiveCountdownPill";
import { PageShimmer } from "./Shimmer";

type NavItem = { href: string; label: string; icon: LucideIcon; minRole?: Role };

const nav: NavItem[] = [
	{ href: "/dashboard", label: "Overview", icon: LayoutDashboard },
	{ href: "/chat", label: "Messages", icon: MessageCircle },
	{ href: "/people", label: "People", icon: Users },
	{ href: "/notifications", label: "Notifications", icon: Bell },
	{ href: "/tracking", label: "Live tracking", icon: MapPin },
	{ href: "/collab/launch-plan", label: "Documents", icon: PanelsTopLeft },
	{ href: "/call/team-sync", label: "Calls", icon: Phone },
	{ href: "/live", label: "Live", icon: Radio },
	{ href: "/admin", label: "Admin", icon: ShieldCheck, minRole: "admin" },
];

function initialsOf(name: string): string {
	const parts = name.trim().split(/\s+/);
	return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function AppShell({
	children,
	title,
	subtitle,
	actions,
}: {
	children: React.ReactNode;
	title: string;
	subtitle?: string;
	actions?: React.ReactNode;
}) {
	const path = usePathname();
	const router = useRouter();
	const { status: authStatus, user, logout } = useAuth();
	const { status: wsStatus } = useWs();
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [highlighted, setHighlighted] = useState(0);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const [inviteOpen, setInviteOpen] = useState(false);
	const [inviteCopied, setInviteCopied] = useState(false);
	const [inviteError, setInviteError] = useState<string | null>(null);
	// Registration is open — there's no invite-token system, so "inviting" someone just
	// means sharing the signup link; anyone with it can create their own account.
	const inviteLink =
		typeof window === "undefined" ? "" : `${window.location.origin}/register`;

	const searchablePages = useMemo(() => {
		const visible = nav.filter((item) => hasRole(user?.role, item.minRole ?? "user"));
		return [
			...visible.map((item) => ({ ...item, keywords: item.label })),
			{
				href: "/settings",
				label: "Settings",
				icon: Settings,
				keywords: "profile account name photo",
			},
		];
	}, [user?.role]);

	const searchResults = useMemo(() => {
		const query = searchQuery.trim().toLocaleLowerCase();
		if (!query) return searchablePages;
		return searchablePages.filter((item) =>
			`${item.label} ${item.keywords}`.toLocaleLowerCase().includes(query),
		);
	}, [searchQuery, searchablePages]);

	useEffect(() => {
		if (authStatus === "unauthenticated") router.replace("/login");
	}, [authStatus, router]);

	useEffect(() => {
		function onShortcut(event: KeyboardEvent) {
			if (
				(event.metaKey || event.ctrlKey) &&
				event.key.toLocaleLowerCase() === "k"
			) {
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

	async function copyInviteLink() {
		setInviteError(null);
		try {
			await navigator.clipboard.writeText(inviteLink);
			setInviteCopied(true);
			setTimeout(() => setInviteCopied(false), 2000);
		} catch {
			setInviteError(
				"Could not copy the link. Select it and copy it manually.",
			);
		}
	}

	async function shareInvite() {
		if (!navigator.share) {
			await copyInviteLink();
			return;
		}
		try {
			await navigator.share({
				title: "Join me on relay",
				text: "Join me on relay",
				url: inviteLink,
			});
		} catch (err) {
			if (err instanceof DOMException && err.name === "AbortError") return;
			setInviteError(
				"This device could not open the share menu. You can copy the link instead.",
			);
		}
	}

	if (authStatus !== "authenticated" || !user) {
		return (
			<div className="app-shell">
				<main className="main">
					<PageShimmer />
				</main>
			</div>
		);
	}

	return (
		<div className="app-shell">
			<aside className="sidebar">
				<Link className="brand" href="/dashboard">
					<span className="brand-mark">
						<Zap size={19} fill="currentColor" />
					</span>
					<span>relay</span>
				</Link>
				<nav className="nav">
					<p className="nav-label">Workspace</p>
					{nav
						.filter((item) => hasRole(user.role, item.minRole ?? "user"))
						.map(({ href, label, icon: Icon }) => (
							<Link
								key={href}
								href={href}
								className={
									path.startsWith(href.split("/").slice(0, 2).join("/"))
										? "active"
										: ""
								}
							>
								<Icon size={19} />
								<span>{label}</span>
							</Link>
						))}
				</nav>
				<div className="sidebar-bottom">
					<button
						type="button"
						onClick={() => {
							setInviteOpen(true);
							setInviteCopied(false);
							setInviteError(null);
						}}
					>
						<Users size={19} /> Invite people
					</button>
					<Link
						href="/settings"
						className={path.startsWith("/settings") ? "active" : ""}
					>
						<Settings size={19} /> Settings
					</Link>
					<button
						className="user-card"
						onClick={() => logout().then(() => router.replace("/login"))}
						title="Sign out"
					>
						<Avatar
							initials={initialsOf(user.displayName)}
							color="green"
							online
							src={user.avatarUrl}
						/>
						<div>
							<strong>{user.displayName}</strong>
							<small>{user.email}</small>
						</div>
						<ChevronDown size={16} />
					</button>
				</div>
			</aside>
			<main className="main">
				<header className="topbar">
					<div>
						<h1>{title}</h1>
						{subtitle && <p>{subtitle}</p>}
					</div>
					<div className="top-actions">
						<LiveCountdownPill />
						{wsStatus !== "connected" && (
							<span className={`conn-pill ${wsStatus}`}>
								<i />
								{wsStatus === "reconnecting"
									? "Reconnecting…"
									: wsStatus === "connecting"
										? "Connecting…"
										: "Live updates unavailable"}
							</span>
						)}
						<button
							className="search-btn"
							onClick={() => setSearchOpen(true)}
							aria-label="Search workspace"
						>
							<Search size={18} />
							<span>Search anything</span>
							<kbd>Ctrl K</kbd>
						</button>
						{actions}
						<Link href="/notifications" className="icon-btn">
							<Bell size={19} />
						</Link>
					</div>
				</header>
				{children}
			</main>
			{searchOpen && (
				<div
					className="global-search-backdrop"
					onMouseDown={(event) => {
						if (event.target === event.currentTarget) setSearchOpen(false);
					}}
				>
					<section
						className="global-search"
						role="dialog"
						aria-modal="true"
						aria-label="Search workspace"
					>
						<div className="global-search-input">
							<Search size={19} />
							<input
								ref={searchInputRef}
								value={searchQuery}
								onChange={(event) => {
									setSearchQuery(event.target.value);
									setHighlighted(0);
								}}
								onKeyDown={(event) => {
									if (event.key === "ArrowDown") {
										event.preventDefault();
										setHighlighted((index) =>
											Math.min(index + 1, searchResults.length - 1),
										);
									}
									if (event.key === "ArrowUp") {
										event.preventDefault();
										setHighlighted((index) => Math.max(index - 1, 0));
									}
									if (event.key === "Enter" && searchResults[highlighted]) {
										event.preventDefault();
										goToSearchResult(searchResults[highlighted].href);
									}
								}}
								placeholder="Search pages and features…"
								role="combobox"
								aria-expanded="true"
								aria-controls="global-search-results"
								aria-activedescendant={
									searchResults[highlighted]
										? `global-search-result-${highlighted}`
										: undefined
								}
							/>
							<button
								onClick={() => setSearchOpen(false)}
								aria-label="Close search"
							>
								Esc
							</button>
						</div>
						<div
							className="global-search-results"
							id="global-search-results"
							role="listbox"
						>
							{searchResults.map(({ href, label, icon: Icon }, index) => (
								<button
									id={`global-search-result-${index}`}
									role="option"
									aria-selected={highlighted === index}
									className={highlighted === index ? "highlighted" : ""}
									key={href}
									onMouseEnter={() => setHighlighted(index)}
									onClick={() => goToSearchResult(href)}
								>
									<Icon size={18} />
									<span>{label}</span>
									<small>{href}</small>
								</button>
							))}
							{searchResults.length === 0 && (
								<p>No matching pages or features.</p>
							)}
						</div>
						<footer>
							<span>↑↓ Navigate</span>
							<span>Enter Open</span>
							<span>Esc Close</span>
						</footer>
					</section>
				</div>
			)}
			{inviteOpen && (
				<div
					className="share-backdrop"
					onMouseDown={(event) => {
						if (event.target === event.currentTarget) setInviteOpen(false);
					}}
				>
					<section
						className="share-dialog"
						role="dialog"
						aria-modal="true"
						aria-labelledby="invite-title"
					>
						<header>
							<div>
								<h2 id="invite-title">Invite people</h2>
								<p>Anyone with this link can create their own relay account.</p>
							</div>
							<button
								onClick={() => setInviteOpen(false)}
								aria-label="Close invite dialog"
							>
								<X size={18} />
							</button>
						</header>
						<label>
							Invite link
							<div>
								<input
									value={inviteLink}
									readOnly
									onFocus={(event) => event.currentTarget.select()}
								/>
								<button onClick={copyInviteLink}>
									{inviteCopied ? <Check size={16} /> : <Copy size={16} />}{" "}
									{inviteCopied ? "Copied" : "Copy"}
								</button>
							</div>
						</label>
						{inviteError && (
							<p className="share-error" role="alert">
								{inviteError}
							</p>
						)}
						{typeof navigator !== "undefined" &&
							typeof navigator.share === "function" && (
								<button className="primary wide" onClick={shareInvite}>
									<Share2 size={16} /> Share via another app
								</button>
							)}
					</section>
				</div>
			)}
		</div>
	);
}
