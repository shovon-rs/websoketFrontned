"use client";
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/** Animates a number counting up from its previous value to `value` whenever it changes.
 * Returns `null` while `value` is `null` (still loading) so callers can keep showing a shimmer.
 * Respects prefers-reduced-motion by jumping straight to the target value. */
export function useCountUp(value: number | null, duration = 700): number | null {
	const reducedMotion = useReducedMotion();
	const [display, setDisplay] = useState<number | null>(value);
	const fromRef = useRef(0);
	const frameRef = useRef<number | null>(null);

	useEffect(() => {
		if (value === null) {
			setDisplay(null);
			return;
		}
		if (reducedMotion) {
			setDisplay(value);
			fromRef.current = value;
			return;
		}
		const from = fromRef.current;
		const to = value;
		if (from === to) {
			setDisplay(to);
			return;
		}
		const start = performance.now();
		function tick(now: number) {
			const elapsed = now - start;
			const progress = Math.min(1, elapsed / duration);
			// ease-out cubic
			const eased = 1 - Math.pow(1 - progress, 3);
			const current = Math.round(from + (to - from) * eased);
			setDisplay(current);
			if (progress < 1) {
				frameRef.current = requestAnimationFrame(tick);
			} else {
				fromRef.current = to;
			}
		}
		frameRef.current = requestAnimationFrame(tick);
		return () => {
			if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [value, duration, reducedMotion]);

	return display;
}
