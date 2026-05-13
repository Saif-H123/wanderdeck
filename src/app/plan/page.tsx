"use client";

import { useState } from "react";

export default function PlanPage() {
  const [prompt, setPrompt] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, origin, destination }),
      });
      setResult(await res.json());
    } finally {
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
            {loading ? "Planning…" : "Generate itinerary"}
          </button>
        </form>

        {result !== null && (
          <pre className="mt-8 overflow-auto rounded-xl bg-stone-100 p-4 text-xs dark:bg-stone-900 dark:text-stone-200">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </main>
  );
}
