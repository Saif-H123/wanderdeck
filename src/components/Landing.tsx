"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { WorldMap } from "./WorldMap";
import { LocationPanel } from "./LocationPanel";
import { FEATURED_LOCATIONS, type FeaturedLocation } from "@/lib/seed-locations";

export function Landing({ apiKey }: { apiKey: string | null }) {
  const [selected, setSelected] = useState<FeaturedLocation | null>(null);
  const handleSelect = useCallback((loc: FeaturedLocation) => setSelected(loc), []);
  const handleClose = useCallback(() => setSelected(null), []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-stone-100 dark:bg-stone-950">
      {/* Map (or fallback) fills the whole screen */}
      <div className="absolute inset-0">
        {apiKey ? (
          <WorldMap
            apiKey={apiKey}
            onSelect={handleSelect}
            selectedSlug={selected?.slug ?? null}
          />
        ) : (
          <MapFallback onSelect={handleSelect} />
        )}
      </div>

      {/* Hero overlay (top-left, doesn't block the map) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-6 pt-8 sm:px-10 sm:pt-12">
        <div className="pointer-events-auto inline-flex max-w-xl flex-col gap-3 rounded-3xl bg-white/80 p-6 shadow-xl backdrop-blur-xl dark:bg-stone-900/80">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
            wanderdeck
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
            Pick a place. Find out what to do when you get there.
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Tap a pin to see what kind of activities wait there. Or describe
            your own trip and we&rsquo;ll build a deck of hidden cards just for
            you.
          </p>
          <Link
            href="/plan"
            className="self-start rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-stone-700 dark:bg-stone-50 dark:text-stone-900 dark:hover:bg-stone-200"
          >
            Plan your own trip →
          </Link>
        </div>
      </div>

      <LocationPanel location={selected} onClose={handleClose} />
    </main>
  );
}

// Shown when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing — keeps the page
// functional (still browsable list of locations) without rendering a
// broken map.
function MapFallback({ onSelect }: { onSelect: (loc: FeaturedLocation) => void }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <div className="max-w-3xl">
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>Map disabled.</strong> Add{" "}
          <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs dark:bg-amber-900/40">
            NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
          </code>{" "}
          to <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs dark:bg-amber-900/40">.env.local</code> and restart the dev server.
        </div>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {FEATURED_LOCATIONS.map((loc) => (
            <li key={loc.slug}>
              <button
                type="button"
                onClick={() => onSelect(loc)}
                className="block w-full rounded-2xl border border-stone-200 bg-white p-4 text-left transition hover:border-stone-400 dark:border-stone-800 dark:bg-stone-900"
              >
                <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
                  {loc.country}
                </p>
                <p className="mt-1 font-medium text-stone-900 dark:text-stone-50">
                  {loc.name}
                </p>
                <p className="mt-1 text-sm text-stone-500">{loc.tagline}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
