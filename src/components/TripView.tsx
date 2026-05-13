"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TripMap } from "./TripMap";
import { PhotoUploadModal, type ScoreResult } from "./PhotoUploadModal";
import type { GeneratedPlan } from "@/lib/ai/claude";

type StashedTrip = {
  plan: GeneratedPlan;
  origin: string;
  destination: string;
  prompt: string;
  createdAt: number;
};

type RevealedMap = Record<string, boolean>; // key: `${stopIdx}:${cardIdx}`
type ScoreMap = Record<string, ScoreResult>;

export function TripView({ slug, apiKey }: { slug: string; apiKey: string | null }) {
  const [trip, setTrip] = useState<StashedTrip | null>(null);
  const [missing, setMissing] = useState(false);
  const [activeStopIndex, setActiveStopIndex] = useState(0);
  const [revealed, setRevealed] = useState<RevealedMap>({});
  const [scores, setScores] = useState<ScoreMap>({});
  const [uploading, setUploading] = useState<{ stopIdx: number; cardIdx: number } | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(`trip:${slug}`);
    if (!raw) {
      setMissing(true);
      return;
    }
    try {
      setTrip(JSON.parse(raw));
    } catch {
      setMissing(true);
    }
  }, [slug]);

  const handleStopClick = useCallback((i: number) => setActiveStopIndex(i), []);

  const totalScore = useMemo(
    () => Object.values(scores).reduce((sum, s) => sum + s.awardedPoints, 0),
    [scores],
  );

  if (missing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6 dark:bg-stone-950">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
            Trip not found
          </h1>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            Trips are stored in your browser for the current session. If you reloaded or
            opened this on a different device, the trip won&rsquo;t be here yet —
            persistence to a database is the next step on the build.
          </p>
          <Link
            href="/plan"
            className="mt-6 inline-block rounded-full bg-stone-900 px-6 py-2 text-sm font-medium text-white dark:bg-stone-50 dark:text-stone-900"
          >
            Plan a new trip
          </Link>
        </div>
      </main>
    );
  }

  if (!trip) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-stone-950">
        <p className="text-sm text-stone-500">Loading…</p>
      </main>
    );
  }

  const activeStop = trip.plan.stops[activeStopIndex];
  const uploadingCard =
    uploading != null ? trip.plan.stops[uploading.stopIdx].cards[uploading.cardIdx] : null;
  const uploadingStop = uploading != null ? trip.plan.stops[uploading.stopIdx] : null;

  return (
    <main className="grid h-screen w-screen grid-rows-[1fr_auto] bg-stone-100 dark:bg-stone-950 md:grid-cols-[1fr_28rem] md:grid-rows-1">
      {/* Map */}
      <div className="relative h-full min-h-0">
        {apiKey ? (
          <TripMap
            apiKey={apiKey}
            plan={trip.plan}
            activeStopIndex={activeStopIndex}
            onStopClick={handleStopClick}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-stone-500">
            Map disabled — add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local and restart.
          </div>
        )}

        {/* Trip header overlay */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-6">
          <div className="pointer-events-auto rounded-2xl bg-white/85 p-4 shadow-lg backdrop-blur dark:bg-stone-900/85">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
              {trip.origin} → {trip.destination}
            </p>
            <p className="mt-1 text-sm text-stone-700 dark:text-stone-300">
              {trip.plan.stops.length} stops
            </p>
          </div>
          <div className="pointer-events-auto rounded-2xl bg-white/85 p-4 shadow-lg backdrop-blur dark:bg-stone-900/85">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
              Score
            </p>
            <p className="mt-1 text-xl font-semibold text-stone-900 dark:text-stone-50">
              {totalScore}
            </p>
          </div>
        </div>
      </div>

      {/* Sidebar — active stop + cards */}
      <aside className="flex h-full flex-col overflow-hidden border-t border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 md:border-l md:border-t-0">
        <StopSwitcher
          stops={trip.plan.stops}
          activeIndex={activeStopIndex}
          onSelect={setActiveStopIndex}
          scores={scores}
        />

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Stop {activeStopIndex + 1} · {activeStop.arrivalEstimate}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
            {activeStop.name}
          </h2>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            {activeStop.description}
          </p>

          <div className="mt-5 space-y-3">
            {activeStop.cards.map((card, cardIdx) => {
              const key = `${activeStopIndex}:${cardIdx}`;
              const isRevealed = revealed[key] ?? false;
              const score = scores[key];
              return (
                <Card
                  key={cardIdx}
                  card={card}
                  revealed={isRevealed}
                  score={score}
                  onReveal={() => setRevealed((r) => ({ ...r, [key]: true }))}
                  onPhoto={() => setUploading({ stopIdx: activeStopIndex, cardIdx })}
                />
              );
            })}
          </div>
        </div>
      </aside>

      <PhotoUploadModal
        open={uploading !== null}
        onClose={() => setUploading(null)}
        onScored={(result) => {
          if (!uploading) return;
          const key = `${uploading.stopIdx}:${uploading.cardIdx}`;
          setScores((s) => {
            const existing = s[key];
            if (existing && existing.awardedPoints >= result.awardedPoints) return s;
            return { ...s, [key]: result };
          });
          setUploading(null);
        }}
        card={uploadingCard}
        stop={uploadingStop}
      />
    </main>
  );
}

function StopSwitcher({
  stops,
  activeIndex,
  onSelect,
  scores,
}: {
  stops: GeneratedPlan["stops"];
  activeIndex: number;
  onSelect: (i: number) => void;
  scores: ScoreMap;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-stone-200 px-3 py-3 dark:border-stone-800">
      {stops.map((stop, i) => {
        const stopScore = stops[i].cards.reduce((sum, _, cardIdx) => {
          const s = scores[`${i}:${cardIdx}`];
          return sum + (s?.awardedPoints ?? 0);
        }, 0);
        const isActive = i === activeIndex;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              isActive
                ? "bg-stone-900 text-white dark:bg-stone-50 dark:text-stone-900"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300"
            }`}
          >
            <span>{i + 1}. {stop.name}</span>
            {stopScore > 0 && (
              <span className="rounded-full bg-emerald-500/20 px-1.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                {stopScore}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Card({
  card,
  revealed,
  score,
  onReveal,
  onPhoto,
}: {
  card: GeneratedPlan["stops"][number]["cards"][number];
  revealed: boolean;
  score?: ScoreResult;
  onReveal: () => void;
  onPhoto: () => void;
}) {
  if (!revealed) {
    return (
      <button
        type="button"
        onClick={onReveal}
        className="group block w-full rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 p-5 text-left transition hover:border-stone-400 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-950 dark:hover:bg-stone-800"
      >
        <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
          Hidden card · tap to reveal
        </p>
        <p className="mt-2 text-base italic text-stone-700 dark:text-stone-300">
          &ldquo;{card.hiddenHint}&rdquo;
        </p>
        <p className="mt-3 text-xs text-stone-400">{card.basePoints} pts</p>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
      <div className="flex items-start justify-between gap-2">
        <p className="text-base font-medium text-stone-900 dark:text-stone-50">{card.title}</p>
        <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-400">
          {card.basePoints} pts
        </span>
      </div>
      <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
        {card.revealedDescription}
      </p>
      <p className="mt-3 text-xs text-stone-500">
        <span className="font-medium uppercase tracking-wider">Photo brief:</span>{" "}
        {card.scoringCriteria}
      </p>

      {score ? (
        <ScoreReadout score={score} basePoints={card.basePoints} />
      ) : (
        <button
          type="button"
          onClick={onPhoto}
          className="mt-4 w-full rounded-full bg-stone-900 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700 dark:bg-stone-50 dark:text-stone-900 dark:hover:bg-stone-200"
        >
          Submit a photo
        </button>
      )}
    </div>
  );
}

function ScoreReadout({ score, basePoints }: { score: ScoreResult; basePoints: number }) {
  const distance =
    score.distanceMeters == null
      ? "no location data"
      : score.distanceMeters > 1000
        ? `${(score.distanceMeters / 1000).toFixed(1)} km from stop`
        : `${Math.round(score.distanceMeters)} m from stop`;
  return (
    <div
      className={`mt-4 rounded-xl p-4 text-sm ${
        score.matches
          ? "bg-emerald-50 dark:bg-emerald-950/40"
          : "bg-amber-50 dark:bg-amber-950/40"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={
            score.matches
              ? "text-emerald-900 dark:text-emerald-200"
              : "text-amber-900 dark:text-amber-200"
          }
        >
          {score.matches ? "Scored" : "Not quite"}
        </span>
        <span
          className={`text-lg font-semibold ${
            score.matches
              ? "text-emerald-900 dark:text-emerald-200"
              : "text-amber-900 dark:text-amber-200"
          }`}
        >
          {score.awardedPoints} / {basePoints}
        </span>
      </div>
      <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
        Activity {Math.round(score.activityScore * 100)}% · Location {Math.round(score.locationScore * 100)}% · {distance}
      </p>
      <p className="mt-2 text-xs text-stone-700 dark:text-stone-300">{score.reasoning}</p>
    </div>
  );
}
