import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";

type ShimmerProps = {
	className?: string;
	style?: React.CSSProperties;
};

export function Shimmer({ className = "", style }: ShimmerProps) {
	return <span className={`shimmer ${className}`} style={style} aria-hidden="true" />;
}

export function ListShimmer({ rows = 4 }: { rows?: number }) {
	return (
		<motion.div className="shimmer-list" aria-label="Loading" role="status" variants={staggerContainer} initial="hidden" animate="visible">
			{Array.from({ length: rows }, (_, index) => (
				<motion.div className="shimmer-list-row" key={index} variants={staggerItem}>
					<Shimmer className="shimmer-avatar" />
					<span>
						<Shimmer className="shimmer-line medium" />
						<Shimmer className="shimmer-line short" />
					</span>
				</motion.div>
			))}
		</motion.div>
	);
}

function CardsShimmer() {
	return (
		<motion.div className="page shimmer-page" aria-label="Loading" role="status" variants={staggerContainer} initial="hidden" animate="visible">
			<motion.div variants={staggerItem}>
				<Shimmer className="shimmer-line title" />
				<Shimmer className="shimmer-line medium" />
			</motion.div>
			<div className="shimmer-card-grid">
				{Array.from({ length: 3 }, (_, index) => (
					<motion.div key={index} variants={staggerItem}>
						<Shimmer className="shimmer-card" />
					</motion.div>
				))}
			</div>
		</motion.div>
	);
}

function CallShimmer() {
	return (
		<div className="page shimmer-page" aria-label="Loading call" role="status">
			<Shimmer className="shimmer-call-stage" />
			<div className="shimmer-call-controls">
				{Array.from({ length: 4 }, (_, index) => (
					<Shimmer className="shimmer-control" key={index} />
				))}
			</div>
		</div>
	);
}

function DocumentShimmer() {
	return (
		<div className="editor-shell shimmer-document" aria-label="Loading document" role="status">
			<Shimmer className="shimmer-line title" />
			<Shimmer className="shimmer-toolbar" />
			<div>
				{Array.from({ length: 7 }, (_, index) => (
					<Shimmer className={`shimmer-line ${index % 3 === 2 ? "medium" : ""}`} key={index} />
				))}
			</div>
		</div>
	);
}

/** Task/document detail: title block, a row of meta pills, then two stacked list sections
 * (attachments, comments) — mirrors the actual detail-page layout instead of a generic grid. */
function DetailShimmer() {
	return (
		<motion.div className="page narrow shimmer-page" aria-label="Loading" role="status" variants={staggerContainer} initial="hidden" animate="visible">
			<motion.section className="card" variants={staggerItem}>
				<Shimmer className="shimmer-line title" />
				<Shimmer className="shimmer-line medium" />
				<div className="shimmer-pill-row">
					<Shimmer className="shimmer-pill" />
					<Shimmer className="shimmer-pill" />
					<Shimmer className="shimmer-pill" />
				</div>
			</motion.section>
			<motion.section className="card" variants={staggerItem}>
				<Shimmer className="shimmer-line short" />
				<div className="shimmer-list-row">
					<Shimmer className="shimmer-avatar" style={{ borderRadius: 8 }} />
					<span>
						<Shimmer className="shimmer-line medium" />
					</span>
				</div>
			</motion.section>
			<motion.section className="card" variants={staggerItem}>
				<Shimmer className="shimmer-line short" />
				{Array.from({ length: 3 }, (_, index) => (
					<div className="shimmer-list-row" key={index}>
						<Shimmer className="shimmer-avatar" />
						<span>
							<Shimmer className="shimmer-line medium" />
							<Shimmer className="shimmer-line short" />
						</span>
					</div>
				))}
			</motion.section>
		</motion.div>
	);
}

/** Kanban board: a header row + N columns, each with a header line and a few stacked cards —
 * for the project board page. */
function BoardShimmer() {
	return (
		<motion.div className="page shimmer-page" aria-label="Loading board" role="status" variants={staggerContainer} initial="hidden" animate="visible">
			<motion.div variants={staggerItem}>
				<Shimmer className="shimmer-line title" />
			</motion.div>
			<div className="shimmer-board">
				{Array.from({ length: 3 }, (_, col) => (
					<motion.div className="shimmer-board-col" key={col} variants={staggerItem}>
						<Shimmer className="shimmer-line short" />
						{Array.from({ length: 3 }, (_, row) => (
							<Shimmer className="shimmer-board-card" key={row} />
						))}
					</motion.div>
				))}
			</div>
		</motion.div>
	);
}

/** Month grid — a toolbar line plus a 7-column grid of day cells, matching the calendar page. */
function CalendarShimmer() {
	return (
		<motion.div className="page shimmer-page" aria-label="Loading calendar" role="status" variants={staggerContainer} initial="hidden" animate="visible">
			<motion.div variants={staggerItem}>
				<Shimmer className="shimmer-line medium" />
			</motion.div>
			<div className="shimmer-calendar-grid">
				{Array.from({ length: 35 }, (_, index) => (
					<Shimmer className="shimmer-calendar-cell" key={index} />
				))}
			</div>
		</motion.div>
	);
}

/** A settings/profile-style form: avatar circle + label/input pairs. */
function FormShimmer() {
	return (
		<motion.div className="page narrow shimmer-page" aria-label="Loading" role="status" variants={staggerContainer} initial="hidden" animate="visible">
			<motion.section className="card" variants={staggerItem} style={{ display: "flex", alignItems: "center", gap: 16 }}>
				<Shimmer className="shimmer-avatar" style={{ width: 64, height: 64 }} />
				<span style={{ flex: 1 }}>
					<Shimmer className="shimmer-line medium" />
					<Shimmer className="shimmer-line short" />
				</span>
			</motion.section>
			<motion.section className="card" variants={staggerItem}>
				{Array.from({ length: 3 }, (_, index) => (
					<div key={index} style={{ marginBottom: 16 }}>
						<Shimmer className="shimmer-line short" style={{ height: 8, marginBottom: 8 }} />
						<Shimmer className="shimmer-line" style={{ height: 36, borderRadius: 8 }} />
					</div>
				))}
			</motion.section>
		</motion.div>
	);
}

export function PageShimmer({
	variant = "cards",
}: {
	variant?: "cards" | "call" | "document" | "detail" | "board" | "calendar" | "form";
}) {
	if (variant === "call") return <CallShimmer />;
	if (variant === "document") return <DocumentShimmer />;
	if (variant === "detail") return <DetailShimmer />;
	if (variant === "board") return <BoardShimmer />;
	if (variant === "calendar") return <CalendarShimmer />;
	if (variant === "form") return <FormShimmer />;
	return <CardsShimmer />;
}
