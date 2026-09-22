"use client";

import { AuthErrorMessage } from "@/components/AuthErrorMessage";
import { PasswordField } from "@/components/PasswordField";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { fadeIn, fadeInUp, tapScale } from "@/lib/motion";
import { strongPasswordError } from "@/lib/password";
import { motion } from "framer-motion";
import { Loader2, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ChangePasswordRequired() {
	const router = useRouter();
	const { status, user, changePassword } = useAuth();
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [newPassword, setNewPassword] = useState("");

	useEffect(() => {
		if (status === "unauthenticated") router.replace("/login");
		if (status === "authenticated" && user && !user.mustChangePassword) {
			router.replace("/dashboard");
		}
	}, [status, user, router]);

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError(null);

		const form = new FormData(e.currentTarget);
		const oldPassword = String(form.get("oldPassword") ?? "");
		const newPassword = String(form.get("newPassword") ?? "");
		const confirmNewPassword = String(form.get("confirmNewPassword") ?? "");

		if (newPassword !== confirmNewPassword) {
			setError("Passwords do not match.");
			return;
		}
		const strengthError = strongPasswordError(newPassword);
		if (strengthError) {
			setError(strengthError);
			return;
		}

		setSubmitting(true);
		try {
			await changePassword(oldPassword, newPassword);
			router.push("/dashboard");
		} catch (err) {
			setError(
				err instanceof ApiError
					? err.message
					: "Could not change your password. Please try again.",
			);
		} finally {
			setSubmitting(false);
		}
	}

	if (status !== "authenticated" || !user?.mustChangePassword) return null;

	return (
		<main className="auth">
			<motion.section className="auth-art" variants={fadeIn} initial="hidden" animate="visible">
				<span className="brand light">
					<span className="brand-mark">
						<Zap fill="currentColor" />
					</span>
					relay
				</span>
				<div>
					<span className="eyebrow">ONE MORE STEP</span>
					<h1>Choose your own password.</h1>
					<p>
						An administrator created this account for you with a temporary
						password. Set a password only you know before continuing.
					</p>
				</div>
				<small>© 2026 Relay, Inc.</small>
			</motion.section>
			<section className="auth-form">
				<motion.form onSubmit={onSubmit} variants={fadeInUp} initial="hidden" animate="visible">
					<h2>Set a new password</h2>
					<p>Enter the temporary password you were given, then choose a new one.</p>
					<label>
						Temporary password
						<PasswordField
							name="oldPassword"
							placeholder="Temporary password"
							autoComplete="current-password"
							required
						/>
					</label>
					<label>
						New password
						<PasswordField
							name="newPassword"
							placeholder="At least 8 characters"
							minLength={8}
							autoComplete="new-password"
							required
							onChange={setNewPassword}
						/>
						<PasswordStrengthMeter password={newPassword} />
						<small>
							Must be 8+ characters with an uppercase letter, a lowercase
							letter, a number, and a special character.
						</small>
					</label>
					<label>
						Confirm new password
						<PasswordField
							name="confirmNewPassword"
							placeholder="Enter your new password again"
							minLength={8}
							autoComplete="new-password"
							required
						/>
					</label>
					<AuthErrorMessage message={error} />
					<motion.button className="primary wide" disabled={submitting} whileTap={tapScale}>
						{submitting && <Loader2 size={16} className="spin btn-spinner" />}
						{submitting ? "Saving…" : "Continue"}
					</motion.button>
				</motion.form>
			</section>
		</main>
	);
}
