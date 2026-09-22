"use client";

import { AppShell } from "@/components/AppShell";
import { AuthErrorMessage } from "@/components/AuthErrorMessage";
import { Avatar } from "@/components/Avatar";
import { Shimmer } from "@/components/Shimmer";
import { ApiError } from "@/lib/api-client";
import * as chatApi from "@/lib/api/chat.api";
import * as usersApi from "@/lib/api/users.api";
import { fadeInUp, staggerContainer, staggerItem } from "@/lib/motion";
import { formatLastSeen } from "@/lib/time";
import type { PresenceUser } from "@/lib/types";
import { useWs } from "@/lib/ws-context";
import { motion } from "framer-motion";
import { MessageCircle, Search, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Filter = "all" | "online" | "offline";

function initialsOf(name: string | null | undefined): string {
	const trimmed = (name ?? "").trim();
	if (!trimmed) return "?";
	const parts = trimmed.split(/\s+/);
	return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function PeoplePage() {
	const router = useRouter();
	const { status: wsStatus } = useWs();
	const [people, setPeople] = useState<PresenceUser[]>([]);
	const [loading, setLoading] = useState(true);
	const [openingUserId, setOpeningUserId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [filter, setFilter] = useState<Filter>("all");
	const [query, setQuery] = useState("");

	const loadPeople = useCallback(async () => {
		try {
			const result = await usersApi.getPresence();
			setPeople(result);
			setError(null);
		} catch (err) {
			setError(
				err instanceof ApiError
					? err.message
					: "Could not load workspace members.",
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadPeople();
		const timer = window.setInterval(loadPeople, 15000);
		return () => window.clearInterval(timer);
	}, [loadPeople]);

	useEffect(() => {
		if (wsStatus === "connected") void loadPeople();
	}, [wsStatus, loadPeople]);

	async function openChat(person: PresenceUser) {
		if (openingUserId) return;
		setOpeningUserId(person.id);
		setError(null);
		try {
			const conversation = await chatApi.createConversation({
				memberIds: [person.id],
				type: "direct",
			});
			router.push(`/chat/${conversation.id}`);
		} catch (err) {
			setError(
				err instanceof ApiError
					? err.message
					: `Could not open a chat with ${person.displayName}.`,
			);
			setOpeningUserId(null);
		}
	}

	const online = useMemo(() => people.filter((person) => person.online), [people]);
	const offline = useMemo(() => people.filter((person) => !person.online), [people]);

	const filtered = useMemo(() => {
		const base = filter === "online" ? online : filter === "offline" ? offline : people;
		const q = query.trim().toLocaleLowerCase();
		if (!q) return base;
		return base.filter(
			(person) =>
				person.displayName.toLocaleLowerCase().includes(q) ||
				person.email.toLocaleLowerCase().includes(q),
		);
	}, [filter, online, offline, people, query]);

	return (
		<AppShell
			title="People"
			subtitle="See who is available and start a conversation."
		>
			<div className="page people-page">
				<AuthErrorMessage message={error} />
				<div className="people-toolbar">
					<div className="people-tabs" role="tablist" aria-label="Filter people">
						{(
							[
								["all", "All", people.length],
								["online", "Online", online.length],
								["offline", "Offline", offline.length],
							] as const
						).map(([key, label, count]) => (
							<button
								key={key}
								type="button"
								role="tab"
								aria-selected={filter === key}
								className={filter === key ? "active" : ""}
								onClick={() => setFilter(key)}
							>
								{key === "online" && <span className="people-tab-dot online" />}
								{key === "offline" && <span className="people-tab-dot offline" />}
								{label}
								<em>{count}</em>
							</button>
						))}
					</div>
					<div className="people-search">
						<Search size={15} />
						<input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search people by name or email…"
						/>
					</div>
				</div>

				{loading ? (
					<div className="people-grid">
						{Array.from({ length: 8 }, (_, index) => (
							<div className="people-tile shimmer-people-tile" key={index}>
								<Shimmer className="shimmer-avatar" style={{ width: 52, height: 52, borderRadius: "50%" }} />
								<Shimmer className="shimmer-line medium" />
								<Shimmer className="shimmer-line short" />
							</div>
						))}
					</div>
				) : (
					<motion.div
						className="people-grid"
						variants={staggerContainer}
						initial="hidden"
						animate="visible"
					>
						{filtered.map((person) => (
							<motion.button
								key={person.id}
								className="people-tile"
								onClick={() => openChat(person)}
								disabled={openingUserId !== null}
								variants={staggerItem}
							>
								<span className="people-tile-top">
									<Avatar
										initials={initialsOf(person.displayName)}
										color={person.online ? "green" : "blue"}
										online={person.online}
										src={person.avatarUrl}
										size="lg"
									/>
									<span className="people-tile-cta" aria-hidden="true">
										<MessageCircle />
									</span>
								</span>
								<strong>{person.displayName}</strong>
								<span className="people-status">
									<span className={`people-status-dot ${person.online ? "online" : "offline"}`} />
									<small>
										{person.online
											? "Active now"
											: formatLastSeen(person.lastSeenAt)}
									</small>
								</span>
							</motion.button>
						))}
						{filtered.length === 0 && (
							<motion.p className="people-empty" variants={fadeInUp}>
								<span className="people-empty-icon">
									<UsersRound aria-hidden="true" />
								</span>
								{query.trim()
									? `No one matches “${query.trim()}”.`
									: `No ${filter === "all" ? "" : filter} people to show.`}
							</motion.p>
						)}
					</motion.div>
				)}
			</div>
		</AppShell>
	);
}
