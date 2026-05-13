"use client";

import Link from "next/link";
import type { FeaturedLocation } from "@/lib/seed-locations";

export function LocationPanel({
  location,
  onClose,
}: {
  location: FeaturedLocation | null;
  onClose: () => void;
}) {
  return (
    <div
      className={`pointer-events-none fixed inset-y-0 right-0 z-20 w-full max-w-md p-4 transition-transform duration-300 ease-out sm:p-6 ${
        location ? "translate-x-0" : "translate-x-full"
      }`}
      aria-hidden={!location}
    >
      <div className="pointer-events-auto flex h-full flex-col overflow-hidden rounded-3xl bg-white/95 shadow-2xl backdrop-blur-xl dark:bg-stone-900/95">
        {location && (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 pb-5 pt-6 dark:border-stone-800">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
                  {location.country}
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
                  {location.name}
                </h2>
                <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
                  {location.tagline}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-1.5 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-stone-800 dark:hover:text-stone-50"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-stone-500">
                Things you could do here
              </p>
              <ul className="space-y-3">
                {location.cards.map((card, i) => (
                  <li
                    key={i}
                    className="group rounded-2xl border border-stone-200 bg-stone-50 p-4 transition hover:border-stone-300 dark:border-stone-800 dark:bg-stone-950"
                  >
                    <p className="text-sm font-medium text-stone-900 dark:text-stone-50">
                      {card.title}
                    </p>
                    <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                      {card.hint}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-stone-500">
                Cards are hidden until you arrive. Picking one up reveals what
                it asks for — then you score by sending a photo from the spot.
              </p>
            </div>

            <div className="border-t border-stone-200 px-6 py-5 dark:border-stone-800">
              <Link
                href={`/plan?to=${encodeURIComponent(location.name)}`}
                className="block w-full rounded-full bg-stone-900 py-3 text-center text-sm font-medium text-white transition hover:bg-stone-700 dark:bg-stone-50 dark:text-stone-900 dark:hover:bg-stone-200"
              >
                Plan a trip to {location.name}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
