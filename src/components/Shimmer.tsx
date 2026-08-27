type ShimmerProps = {
	className?: string;
};

export function Shimmer({ className = "" }: ShimmerProps) {
	return <span className={`shimmer ${className}`} aria-hidden="true" />;
}

export function ListShimmer({ rows = 4 }: { rows?: number }) {
	return (
		<div className="shimmer-list" aria-label="Loading" role="status">
			{Array.from({ length: rows }, (_, index) => (
				<div className="shimmer-list-row" key={index}>
					<Shimmer className="shimmer-avatar" />
					<span>
						<Shimmer className="shimmer-line medium" />
						<Shimmer className="shimmer-line short" />
					</span>
				</div>
			))}
		</div>
	);
}

export function PageShimmer({
	variant = "cards",
}: {
	variant?: "cards" | "call" | "document";
}) {
	if (variant === "call")
		return (
			<div
				className="page shimmer-page"
				aria-label="Loading call"
				role="status"
			>
				<Shimmer className="shimmer-call-stage" />
				<div className="shimmer-call-controls">
					{Array.from({ length: 4 }, (_, index) => (
						<Shimmer className="shimmer-control" key={index} />
					))}
				</div>
			</div>
		);

	if (variant === "document")
		return (
			<div
				className="editor-shell shimmer-document"
				aria-label="Loading document"
				role="status"
			>
				<Shimmer className="shimmer-line title" />
				<Shimmer className="shimmer-toolbar" />
				<div>
					{Array.from({ length: 7 }, (_, index) => (
						<Shimmer
							className={`shimmer-line ${index % 3 === 2 ? "medium" : ""}`}
							key={index}
						/>
					))}
				</div>
			</div>
		);

	return (
		<div className="page shimmer-page" aria-label="Loading" role="status">
			<Shimmer className="shimmer-line title" />
			<Shimmer className="shimmer-line medium" />
			<div className="shimmer-card-grid">
				{Array.from({ length: 3 }, (_, index) => (
					<Shimmer className="shimmer-card" key={index} />
				))}
			</div>
		</div>
	);
}
