"use client";

import Link from "next/link";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/db/supabase-browser";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setSending(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 px-6 py-12 dark:bg-stone-950">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="font-display block text-center text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50"
        >
          wanderdeck
        </Link>
        <div className="mt-8 rounded-3xl bg-white p-8 shadow-xl dark:bg-stone-900">
          {sent ? (
            <div className="space-y-3 text-center">
              <h1 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-50">
                Check your email
              </h1>
              <p className="text-sm text-stone-600 dark:text-stone-400">
                We sent a sign-in link to <strong>{email}</strong>. Click it and you&rsquo;ll be
                back here.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="text-xs font-medium text-stone-500 underline-offset-2 hover:underline"
              >
                Try a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h1 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-50">
                  Sign in
                </h1>
                <p className="mt-1 text-sm text-stone-500">
                  We&rsquo;ll email you a one-tap sign-in link. No password.
                </p>
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none focus:border-stone-900 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-50"
              />
              {error && (
                <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={sending || !email.trim()}
                className="w-full rounded-full bg-stone-900 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-stone-50 dark:text-stone-900"
              >
                {sending ? "Sending link…" : "Send me a link"}
              </button>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-stone-500">
          By signing in, you agree to nothing in particular yet.
        </p>
      </div>
    </main>
  );
}
