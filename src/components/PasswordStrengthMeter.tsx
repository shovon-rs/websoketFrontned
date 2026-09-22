"use client";

import { motion } from "framer-motion";

const RULES: { test: (value: string) => boolean }[] = [
	{ test: (v) => v.length >= 8 },
	{ test: (v) => /[a-z]/.test(v) },
	{ test: (v) => /[A-Z]/.test(v) },
	{ test: (v) => /[0-9]/.test(v) },
	{ test: (v) => /[^A-Za-z0-9]/.test(v) },
];

const LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"];
const COLORS = ["#dd5549", "#e07a3f", "#e0a23f", "#5c9c55", "#33845e"];

/** Live strength readout for a new-password field, mirroring the backend's actual policy
 * (`strongPasswordError`) so the bar always agrees with what will pass validation. Animates its
 * fill instead of jumping, and stays silent until the user has typed something. */
export function PasswordStrengthMeter({ password }: { password: string }) {
	if (!password) return null;
	const score = RULES.reduce((count, rule) => count + (rule.test(password) ? 1 : 0), 0);
	const index = Math.max(0, score - 1);
	const percent = (score / RULES.length) * 100;

	return (
		<div className="password-strength" aria-live="polite">
			<div className="password-strength-track">
				<motion.div
					className="password-strength-fill"
					style={{ background: COLORS[index] }}
					initial={false}
					animate={{ width: `${percent}%` }}
					transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
				/>
			</div>
			<span style={{ color: COLORS[index] }}>{LABELS[index]}</span>
		</div>
	);
}
