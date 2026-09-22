"use client";

import { AnimatePresence, motion } from "framer-motion";

/** Shared error entrance for the auth-adjacent pages (login/register/change-password) — a quick
 * fade + settle instead of the message just popping into the layout. */
export function AuthErrorMessage({ message }: { message: string | null }) {
	return (
		<AnimatePresence mode="wait">
			{message && (
				<motion.p
					className="auth-error"
					role="alert"
					key={message}
					initial={{ opacity: 0, x: -6 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
				>
					{message}
				</motion.p>
			)}
		</AnimatePresence>
	);
}
