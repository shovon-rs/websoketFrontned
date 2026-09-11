"use client";

import { PasswordField } from "@/components/PasswordField";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { strongPasswordError } from "@/lib/password";
import { Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ChangePasswordRequired() {
	const router = useRouter();
	const { status, user, changePassword } = useAuth();
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

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
			<section className="auth-art">
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
			</section>
			<section className="auth-form">
				<form onSubmit={onSubmit}>
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
						/>
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
					{error && (
						<p className="auth-error" role="alert">
							{error}
						</p>
					)}
					<button className="primary wide" disabled={submitting}>
						{submitting ? "Saving…" : "Continue"}
					</button>
				</form>
			</section>
		</main>
	);
}
