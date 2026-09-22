"use client";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Chart } from "@/components/Chart";
import { Shimmer } from "@/components/Shimmer";
import * as dashboardApi from "@/lib/api/dashboard.api";
import * as tasksApi from "@/lib/api/tasks.api";
import { useAuth } from "@/lib/auth-context";
import { fadeInUp, hoverLift, staggerContainer, staggerItem, tapScale } from "@/lib/motion";
import { isSuperAdmin } from "@/lib/roles";
import type { DashboardMetrics } from "@/lib/types";
import { useCountUp } from "@/lib/use-count-up";
import { useWs } from "@/lib/ws-context";
import { motion } from "framer-motion";
import {
	ArrowUpRight,
	FileText,
	MapPin,
	MessageCircle,
	Phone,
	Plus,
	Radio,
	Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const TASK_NOTIFICATION_KINDS = new Set(["task:assigned", "task:status-changed", "task:comment-new"]);

function AnimatedMetric({ value }: { value: number | null }) {
	const display = useCountUp(value);
	if (display === null) return <Shimmer className="shimmer-metric" />;
	return <strong>{display}</strong>;
}

// Motion-wrapped Next Link so entrance/hover variants can live directly on the anchor —
// keeps it a direct child of .metric-grid / .quick-actions-grid so existing `>`-combinator
// CSS (a.metric:hover, .quick-actions-grid > a, etc) keeps matching unchanged.
const MotionLink = motion.create(Link);

export default function Dashboard() {
	const { status: authStatus, user } = useAuth();
	const { status: wsStatus, send, subscribe } = useWs();
	const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
	const [conversationCount, setConversationCount] = useState<number | null>(
		null,
	);
	const [callsThisWeek, setCallsThisWeek] = useState<number | null>(null);
	const [chartData, setChartData] = useState<
		{ date: string; count: number }[] | null
	>(null);
	const [taskSummary, setTaskSummary] = useState<{ todo: number; done: number } | null>(null);

	// AppShell redirects to /login when unauthenticated, but it still renders this component's
	// effects on the way there — wait for a real session so we don't fire a doomed request.
	useEffect(() => {
		if (authStatus !== "authenticated") return;
		dashboardApi.getSummary().then((summary) => {
			setMetrics({
				activeConnections: summary.activeConnections,
				onlineUsers: summary.activeConnections,
				generatedAt: summary.generatedAt,
			});
			setConversationCount(summary.conversationCount);
			setCallsThisWeek(summary.callsThisWeek);
		});
		dashboardApi.getMessageActivity().then(setChartData);
	}, [authStatus]);

	// There's no "assigned to me" filter on the tasks endpoint, so pull the full list and narrow
	// it down client-side to whatever's assigned to the signed-in user.
	const loadTaskSummary = useCallback(() => {
		if (!user) return;
		tasksApi
			.listTasks()
			.then((all) => {
				const mine = all.filter((task) => task.assignees.some((a) => a.id === user.id));
				setTaskSummary({
					todo: mine.filter((task) => task.status !== "done").length,
					done: mine.filter((task) => task.status === "done").length,
				});
			})
			.catch(() => {});
	}, [user]);

	useEffect(() => {
		if (authStatus !== "authenticated") return;
		loadTaskSummary();
	}, [authStatus, loadTaskSummary]);

	// Re-join on every (re)connect — room membership lives on the server connection, not the client.
	useEffect(() => {
		if (wsStatus === "connected") send("dashboard:join", {});
	}, [wsStatus, send]);

	useEffect(
		() =>
			subscribe("dashboard:metrics", (event) =>
				setMetrics(event.payload as DashboardMetrics),
			),
		[subscribe],
	);

	useEffect(() => {
		return subscribe("notification:new", (event) => {
			const payload = event.payload as { data?: { kind?: string } };
			if (!payload.data?.kind || !TASK_NOTIFICATION_KINDS.has(payload.data.kind)) return;
			loadTaskSummary();
		});
	}, [subscribe, loadTaskSummary]);

	const firstName = user?.displayName?.split(" ")[0] ?? "there";
	const totalMessages = chartData?.reduce((sum, d) => sum + d.count, 0) ?? null;

	return (
		<AppShell
			title={`Good to see you, ${firstName}`}
			subtitle="Here’s what’s happening across your workspace."
		>
			<div className="page dashboard-page">
				<motion.div className="welcome" variants={fadeInUp} initial="hidden" animate="visible">
					<div>
						<span className="eyebrow">
							{new Date().toLocaleDateString(undefined, {
								weekday: "long",
								month: "long",
								day: "numeric",
							})}
						</span>
						<h2>Keep the momentum going.</h2>
						<p>
							Live workspace activity updates automatically — no refresh needed.
						</p>
					</div>
					<motion.div whileTap={tapScale}>
						<Link href="/chat" className="primary">
							<Plus size={18} /> Start a conversation
						</Link>
					</motion.div>
				</motion.div>
				<motion.section
					className="metric-grid"
					variants={staggerContainer}
					initial="hidden"
					animate="visible"
				>
					<MotionLink href="/chat" className="metric" variants={staggerItem} whileHover={hoverLift}>
						<span className="metric-icon coral">
							<MessageCircle />
						</span>
						<div>
							<small>Your conversations</small>
							<AnimatedMetric value={conversationCount} />
							<em>See Messages</em>
						</div>
					</MotionLink>
					<MotionLink href="/people" className="metric" variants={staggerItem} whileHover={hoverLift}>
						<span className="metric-icon blue">
							<Users />
						</span>
						<div>
							<small>Online now</small>
							<AnimatedMetric value={metrics?.onlineUsers ?? null} />
							<em>See who's online</em>
						</div>
					</MotionLink>
					<MotionLink href="/calls" className="metric" variants={staggerItem} whileHover={hoverLift}>
						<span className="metric-icon violet">
							<Phone />
						</span>
						<div>
							<small>Calls this week</small>
							<AnimatedMetric value={callsThisWeek} />
							<em>See call history</em>
						</div>
					</MotionLink>
					<MotionLink
						href={isSuperAdmin(user?.role) ? "/admin?tab=live-locations" : "/tracking"}
						className="metric"
						variants={staggerItem}
						whileHover={hoverLift}
					>
						<span className="metric-icon green">
							<Radio />
						</span>
						<div>
							<small>Connection</small>
							<strong className="status-word">
								{wsStatus === "connected"
									? "Live"
									: wsStatus === "reconnecting"
										? "Reconnecting"
										: "Offline"}
							</strong>
							<em>
								<i className={wsStatus === "connected" ? "pulse" : ""} />{" "}
								{isSuperAdmin(user?.role) ? "See live locations" : "Share your location"}
							</em>
						</div>
					</MotionLink>
				</motion.section>
				<div className="dashboard-grid">
					<motion.section
						className="card activity-chart"
						variants={fadeInUp}
						initial="hidden"
						animate="visible"
					>
						<div className="card-head">
							<div>
								<h3>Message activity</h3>
								{totalMessages !== null ? (
									<p>
										{totalMessages} messages across your conversations, last 7
										days
									</p>
								) : (
									<Shimmer className="shimmer-line medium" />
								)}
							</div>
						</div>
						{chartData ? (
							<Chart data={chartData} />
						) : (
							<Shimmer className="shimmer-chart" />
						)}
					</motion.section>
					<motion.section
						className="card live-now"
						variants={fadeInUp}
						initial="hidden"
						animate="visible"
						transition={{ delay: 0.06 }}
					>
						<div className="card-head">
							<div>
								<h3>Live now</h3>
								<p>Active connections across the workspace</p>
							</div>
							<span className="live-pill">
								<i /> {metrics?.activeConnections ?? 0} connections
							</span>
						</div>
						<div className="people-stack">
							<Avatar
								initials={
									user ? user.displayName.slice(0, 2).toUpperCase() : "?"
								}
								color="green"
								online
								src={user?.avatarUrl}
							/>
						</div>
						<p className="quiet">
							Updates every few seconds from the live dashboard channel.
						</p>
						<Link className="text-link" href="/people">
							See who's online <ArrowUpRight size={16} />
						</Link>
					</motion.section>
					<motion.section
						className="card your-tasks"
						variants={fadeInUp}
						initial="hidden"
						animate="visible"
						transition={{ delay: 0.08 }}
					>
						<div className="card-head">
							<div>
								<h3>Your tasks</h3>
								<p>Assigned to you across every project</p>
							</div>
						</div>
						{taskSummary ? (
							<div className="notification-stats">
								<div className="notification-stat">
									<strong>{taskSummary.todo}</strong>
									<small>Need to do</small>
								</div>
								<div className="notification-stat">
									<strong>{taskSummary.done}</strong>
									<small>Completed</small>
								</div>
							</div>
						) : (
							<div className="notification-stats">
								<div className="notification-stat">
									<Shimmer className="shimmer-metric" />
								</div>
								<div className="notification-stat">
									<Shimmer className="shimmer-metric" />
								</div>
							</div>
						)}
						<Link className="text-link" href="/tasks">
							View your tasks <ArrowUpRight size={16} />
						</Link>
					</motion.section>
				</div>
				<motion.section
					className="card quick-actions"
					variants={fadeInUp}
					initial="hidden"
					animate="visible"
					transition={{ delay: 0.1 }}
				>
					<div className="card-head">
						<div>
							<h3>Quick actions</h3>
							<p>Start something or jump back into your work</p>
						</div>
					</div>
					<motion.div
						className="quick-actions-grid"
						variants={staggerContainer}
						initial="hidden"
						animate="visible"
					>
						<MotionLink href="/chat" variants={staggerItem} whileHover={hoverLift} whileTap={tapScale}>
							<span className="quick-action-icon coral">
								<MessageCircle />
							</span>
							<span>
								<strong>Messages</strong>
								<small>Open your conversations</small>
							</span>
							<ArrowUpRight />
						</MotionLink>
						<MotionLink href="/call/team-sync" variants={staggerItem} whileHover={hoverLift} whileTap={tapScale}>
							<span className="quick-action-icon violet">
								<Phone />
							</span>
							<span>
								<strong>Start a call</strong>
								<small>Connect by audio or video</small>
							</span>
							<ArrowUpRight />
						</MotionLink>
						<MotionLink href="/collab/new" variants={staggerItem} whileHover={hoverLift} whileTap={tapScale}>
							<span className="quick-action-icon blue">
								<FileText />
							</span>
							<span>
								<strong>Create document</strong>
								<small>Collaborate in real time</small>
							</span>
							<ArrowUpRight />
						</MotionLink>
						<MotionLink href="/tracking" variants={staggerItem} whileHover={hoverLift} whileTap={tapScale}>
							<span className="quick-action-icon green">
								<MapPin />
							</span>
							<span>
								<strong>Share location</strong>
								<small>Start secure live tracking</small>
							</span>
							<ArrowUpRight />
						</MotionLink>
					</motion.div>
				</motion.section>
			</div>
		</AppShell>
	);
}
