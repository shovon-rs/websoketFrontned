"use client";

import { PasswordField } from "@/components/PasswordField";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Register() {
	const router = useRouter();
	const { register } = useAuth();
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError(null);
		const form = new FormData(e.currentTarget);
		const displayName = String(form.get("displayName") ?? "");
		const email = String(form.get("email") ?? "");
		const password = String(form.get("password") ?? "");
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
			<section className="auth-art">
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
			</section>
			<section className="auth-form">
				<form onSubmit={onSubmit}>
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
						/>
					</label>
					{error && <p className="auth-error">{error}</p>}
					<button className="primary wide" disabled={submitting}>
						{submitting ? "Creating account…" : "Create account"}
					</button>
					<small>
						Already have an account? <Link href="/login">Sign in</Link>
					</small>
				</form>
			</section>
		</main>
	);
}
