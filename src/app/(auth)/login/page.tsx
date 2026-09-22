"use client";

import { AuthErrorMessage } from "@/components/AuthErrorMessage";
import { PasswordField } from "@/components/PasswordField";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { fadeIn, fadeInUp, tapScale } from "@/lib/motion";
import { motion } from "framer-motion";
import { Loader2, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="auth">
    <motion.section className="auth-art" variants={fadeIn} initial="hidden" animate="visible">
      <Link className="brand light" href="/"><span className="brand-mark"><Zap fill="currentColor"/></span>relay</Link>
      <div><span className="eyebrow">REALTIME. RELIABLE. TOGETHER.</span><h1>Work moves faster when everyone’s in sync.</h1><p>Messages, calls, documents, and live updates — beautifully connected in one calm workspace.</p></div>
      <small>© 2026 Relay, Inc.</small>
    </motion.section>
    <section className="auth-form">
      <motion.form onSubmit={onSubmit} variants={fadeInUp} initial="hidden" animate="visible">
      <h2>Welcome back</h2><p>Sign in to continue to your workspace.</p>
      <label>Email address<input name="email" type="email" placeholder="you@company.com" autoComplete="email" required/></label>
      <label><span>Password <a href="#">Forgot password?</a></span><PasswordField placeholder="Enter your password" autoComplete="current-password" required/></label>
      <AuthErrorMessage message={error} />
      <motion.button className="primary wide" disabled={submitting} whileTap={tapScale}>
        {submitting && <Loader2 size={16} className="spin btn-spinner" />}
        {submitting ? "Signing in…" : "Sign in"}
      </motion.button>
      <small>Don’t have an account? <Link href="/register">Create one</Link></small>
      </motion.form>
    </section>
  </main>;
}
