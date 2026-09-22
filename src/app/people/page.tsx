"use client";

import { AppShell } from "@/components/AppShell";
import { AuthErrorMessage } from "@/components/AuthErrorMessage";
import { Avatar } from "@/components/Avatar";
import { ListShimmer } from "@/components/Shimmer";
import { ApiError } from "@/lib/api-client";
import * as chatApi from "@/lib/api/chat.api";
import * as usersApi from "@/lib/api/users.api";
import { fadeInUp, staggerContainer, staggerItem } from "@/lib/motion";
import { formatLastSeen, formatOnlineDuration } from "@/lib/time";
import type { PresenceUser } from "@/lib/types";
import { useWs } from "@/lib/ws-context";
import { motion } from "framer-motion";
import { MessageCircle, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

function initialsOf(name: string): string {
	const parts = name.trim().split(/\s+/);
	return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function PeoplePage() {
	const router = useRouter();
	const { status: wsStatus } = useWs();
	const [people, setPeople] = useState<PresenceUser[]>([]);
	const [loading, setLoading] = useState(true);
	const [openingUserId, setOpeningUserId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

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

	const online = people.filter((person) => person.online);
	const offline = people.filter((person) => !person.online);

	return (
		<AppShell
			title="People"
			subtitle="See who is available and start a conversation."
		>
			<div className="page narrow people-page">
				<AuthErrorMessage message={error} />
				{loading ? (
					<>
						<section className="card people-section">
							<ListShimmer rows={3} />
						</section>
						<section className="card people-section">
							<ListShimmer rows={3} />
						</section>
					</>
				) : (
					<motion.div variants={staggerContainer} initial="hidden" animate="visible">
						<PeopleSection
							title="Online"
							count={online.length}
							people={online}
							openingUserId={openingUserId}
							onOpenChat={openChat}
						/>
						<PeopleSection
							title="Offline"
							count={offline.length}
							people={offline}
							openingUserId={openingUserId}
							onOpenChat={openChat}
						/>
					</motion.div>
				)}
			</div>
		</AppShell>
	);
}

function PeopleSection({
	title,
	count,
	people,
	openingUserId,
	onOpenChat,
}: {
	title: "Online" | "Offline";
	count: number;
	people: PresenceUser[];
	openingUserId: string | null;
	onOpenChat: (person: PresenceUser) => void;
}) {
	return (
		<motion.section className="card people-section" variants={fadeInUp}>
			<header>
				<div>
					<h2>{title}</h2>
					<p>
						{title === "Online"
							? "Available in the workspace now"
							: "Not currently connected"}
					</p>
				</div>
				<span>{count}</span>
			</header>
			<motion.div className="people-list" variants={staggerContainer} initial="hidden" animate="visible">
				{people.map((person) => (
					<motion.button
						key={person.id}
						onClick={() => onOpenChat(person)}
						disabled={openingUserId !== null}
						variants={staggerItem}
					>
						<Avatar
							initials={initialsOf(person.displayName)}
							color={person.online ? "green" : "blue"}
							online={person.online}
							src={person.avatarUrl}
						/>
						<span>
							<strong>{person.displayName}</strong>
							<small>
								{person.online && person.onlineSince
									? formatOnlineDuration(person.onlineSince)
									: formatLastSeen(person.lastSeenAt)}
							</small>
						</span>
						<MessageCircle size={17} />
					</motion.button>
				))}
				{people.length === 0 && (
					<p className="people-empty">
						<UsersRound aria-hidden="true" />
						No {title.toLocaleLowerCase()} people.
					</p>
				)}
			</motion.div>
		</motion.section>
	);
}
