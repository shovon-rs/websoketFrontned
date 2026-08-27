"use client";
import * as usersApi from "@/lib/api/users.api";
import type { User } from "@/lib/types";
import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { ListShimmer } from "./Shimmer";

const PALETTE = ["coral", "blue", "violet", "gold", "green"];
function colorFor(id: string): string {
	let hash = 0;
	for (let i = 0; i < id.length; i++)
		hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
	return PALETTE[hash % PALETTE.length];
}
function initialsOf(name: string): string {
	const parts = name.trim().split(/\s+/);
	return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

const DEBOUNCE_MS = 250;

interface UserSearchDropdownProps {
	onSelect: (user: User) => void;
	placeholder?: string;
	autoFocus?: boolean;
	disabled?: boolean;
}

export function UserSearchDropdown({
	onSelect,
	placeholder = "Search by name or email…",
	autoFocus,
	disabled,
}: UserSearchDropdownProps) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<User[]>([]);
	const [loading, setLoading] = useState(false);
	const [open, setOpen] = useState(false);
	const [highlighted, setHighlighted] = useState(0);

	const rootRef = useRef<HTMLDivElement>(null);
	const requestIdRef = useRef(0);
	const listboxId = useId();

	useEffect(() => {
		const trimmed = query.trim();
		if (!trimmed) {
			setResults([]);
			setLoading(false);
			return;
		}

		setLoading(true);
		const requestId = ++requestIdRef.current;
		const timer = setTimeout(() => {
			usersApi
				.searchUsers(trimmed)
				.then((users) => {
					if (requestIdRef.current !== requestId) return; // a newer keystroke superseded this request
					setResults(users);
					setHighlighted(0);
				})
				.finally(() => {
					if (requestIdRef.current === requestId) setLoading(false);
				});
		}, DEBOUNCE_MS);

		return () => clearTimeout(timer);
	}, [query]);

	useEffect(() => {
		function onClickOutside(e: MouseEvent) {
			if (rootRef.current && !rootRef.current.contains(e.target as Node))
				setOpen(false);
		}
		document.addEventListener("mousedown", onClickOutside);
		return () => document.removeEventListener("mousedown", onClickOutside);
	}, []);

	function select(user: User) {
		onSelect(user);
		setQuery("");
		setResults([]);
		setOpen(false);
	}

	function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (!open || results.length === 0) return;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setHighlighted((i) => Math.min(i + 1, results.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setHighlighted((i) => Math.max(i - 1, 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			const pick = results[highlighted];
			if (pick) select(pick);
		} else if (e.key === "Escape") {
			setOpen(false);
		}
	}

	const showPanel =
		open && (loading || results.length > 0 || query.trim().length > 0);

	return (
		<div className="user-search" ref={rootRef}>
			<div className="filter-search">
				<Search size={17} />
				<input
					role="combobox"
					aria-expanded={showPanel}
					aria-controls={listboxId}
					aria-autocomplete="list"
					placeholder={placeholder}
					value={query}
					autoFocus={autoFocus}
					disabled={disabled}
					onChange={(e) => {
						setQuery(e.target.value);
						setOpen(true);
					}}
					onFocus={() => setOpen(true)}
					onKeyDown={onKeyDown}
				/>
			</div>
			{showPanel && (
				<ul className="user-search-results" id={listboxId} role="listbox">
					{loading && results.length === 0 && (
						<li className="user-search-shimmer">
							<ListShimmer rows={3} />
						</li>
					)}
					{!loading && results.length === 0 && query.trim().length > 0 && (
						<li className="user-search-empty">
							No one found for &ldquo;{query.trim()}&rdquo;
						</li>
					)}
					{results.map((user, i) => (
						<li
							key={user.id}
							role="option"
							aria-selected={i === highlighted}
							className={`user-search-item ${i === highlighted ? "highlighted" : ""}`}
							// mousedown (not click) fires before the input's blur, so the click-outside/blur logic doesn't eat the selection
							onMouseDown={(e) => {
								e.preventDefault();
								select(user);
							}}
							onMouseEnter={() => setHighlighted(i)}
						>
							<Avatar
								initials={initialsOf(user.displayName)}
								color={colorFor(user.id)}
								size="sm"
							/>
							<div>
								<strong>{user.displayName}</strong>
								<small>{user.email}</small>
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
