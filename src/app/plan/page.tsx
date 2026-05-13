"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { GeneratedPlan } from "@/lib/ai/claude";

export default function PlanPage() {
  return (
    <Suspense fallback={null}>
      <PlanForm />
    </Suspense>
  );
}

function PlanForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [prompt, setPrompt] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const to = searchParams.get("to");
    if (to) setDestination(to);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, origin, destination }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message ?? body.error ?? `Plan failed (${res.status})`);
      }
      const { plan } = (await res.json()) as { plan: GeneratedPlan };
      const slug = makeSlug();
      sessionStorage.setItem(
        `trip:${slug}`,
        JSON.stringify({ plan, origin, destination, prompt, createdAt: Date.now() }),
      );
      router.push(`/trip/${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-16 dark:bg-stone-950">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          Describe your trip
        </h1>
        <p className="mt-2 text-stone-600 dark:text-stone-400">
          The more specific, the better the cards.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="From (e.g. London)"
              className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm dark:border-stone-700 dark:bg-stone-900 dark:text-stone-50"
            />
            <input
              required
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="To (e.g. Edinburgh)"
              className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm dark:border-stone-700 dark:bg-stone-900 dark:text-stone-50"
            />
          </div>
          <textarea
            required
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
            placeholder="e.g. A slow road trip, good coffee, weird roadside attractions, nothing touristy. We like hiking but not all day."
            className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm dark:border-stone-700 dark:bg-stone-900 dark:text-stone-50"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-stone-900 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-stone-50 dark:text-stone-900"
          >
            {loading ? "Planning your trip…" : "Generate itinerary"}
          </button>
          {loading && (
            <p className="text-center text-xs text-stone-500">
              Claude is sketching stops and cards. This usually takes 20–40 seconds.
            </p>
          )}
          {error && (
            <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}

function makeSlug(): string {
  return Math.random().toString(36).slice(2, 10);
}
