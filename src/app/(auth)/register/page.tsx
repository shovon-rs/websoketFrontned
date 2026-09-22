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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Register() {
	const router = useRouter();
	const { register } = useAuth();
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [password, setPassword] = useState("");

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError(null);
		const form = new FormData(e.currentTarget);
		const displayName = String(form.get("displayName") ?? "");
		const email = String(form.get("email") ?? "");
		const password = String(form.get("password") ?? "");
		const confirmPassword = String(form.get("confirmPassword") ?? "");
		if (password !== confirmPassword) {
			setError("Passwords do not match.");
			return;
		}
		const passwordError = strongPasswordError(password);
		if (passwordError) {
			setError(passwordError);
			return;
		}
		setSubmitting(true);
		try {
			await register(email, password, displayName);
			router.push("/dashboard");
		} catch (err) {
			setError(
				err instanceof ApiError
					? err.message
					: "Unable to create your account. Please try again.",
			);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<main className="auth">
			<motion.section className="auth-art" variants={fadeIn} initial="hidden" animate="visible">
				<Link className="brand light" href="/">
					<span className="brand-mark">
						<Zap fill="currentColor" />
					</span>
					relay
				</Link>
				<div>
					<span className="eyebrow">A WORKSPACE THAT MOVES WITH YOU.</span>
					<h1>Bring your people and ideas together.</h1>
					<p>
						Start conversations, collaborate live, and turn momentum into
						meaningful work.
					</p>
				</div>
				<small>© 2026 Relay, Inc.</small>
			</motion.section>
			<section className="auth-form">
				<motion.form onSubmit={onSubmit} variants={fadeInUp} initial="hidden" animate="visible">
					<h2>Create your account</h2>
					<p>Set up your Relay workspace in a minute.</p>
					<label>
						Full name
						<input
							name="displayName"
							placeholder="Alex Smith"
							autoComplete="name"
							required
						/>
					</label>
					<label>
						Work email
						<input
							name="email"
							type="email"
							placeholder="you@company.com"
							autoComplete="email"
							required
						/>
					</label>
					<label>
						Password
						<PasswordField
							placeholder="At least 8 characters"
							minLength={8}
							autoComplete="new-password"
							required
							onChange={setPassword}
						/>
						<PasswordStrengthMeter password={password} />
						<small>
							Must be 8+ characters with an uppercase letter, a lowercase
							letter, a number, and a special character.
						</small>
					</label>
					<label>
						Confirm password
						<PasswordField
							name="confirmPassword"
							placeholder="Enter your password again"
							minLength={8}
							autoComplete="new-password"
							required
						/>
					</label>
					<AuthErrorMessage message={error} />
					<motion.button className="primary wide" disabled={submitting} whileTap={tapScale}>
						{submitting && <Loader2 size={16} className="spin btn-spinner" />}
						{submitting ? "Creating account…" : "Create account"}
					</motion.button>
					<small>
						Already have an account? <Link href="/login">Sign in</Link>
					</small>
				</motion.form>
			</section>
		</main>
	);
}
