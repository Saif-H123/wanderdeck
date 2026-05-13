"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { EditableMap, type Pin } from "./EditableMap";
import { PhotoUploadModal, type ScoreResult } from "./PhotoUploadModal";
import type { LatLng } from "@/lib/types";
import type { StoredTrip, StoredSubmission } from "@/lib/db/trips";
import { haversineMeters } from "@/lib/geo";

// Reveal is allowed within this radius of the stop. Looser than the
// full-credit scoring radius (200m) so players have a bit of slack to
// flip the card without standing right on the spot.
const REVEAL_RADIUS_M = 500;

const makeId = () => Math.random().toString(36).slice(2, 10);

type RevealedSet = Set<string>; // set of card.id strings
type ScoreMap = Record<string, ScoreResult>; // keyed by card.id

export function Planner({
  apiKey,
  initialTrip,
  initialSubmissions,
}: {
  apiKey: string | null;
  initialTrip?: StoredTrip;
  initialSubmissions?: StoredSubmission[];
}) {
  const router = useRouter();
  const playMode = !!initialTrip;

  // ---------- Build-mode state ----------
  const [pins, setPins] = useState<Pin[]>(() =>
    initialTrip
      ? initialTrip.stops.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng }))
      : [],
  );
  const [activePinId, setActivePinId] = useState<string | null>(
    initialTrip?.stops[0]?.id ?? null,
  );
  const [vibe, setVibe] = useState(initialTrip?.vibe ?? "");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------- Play-mode state ----------
  const [revealed, setRevealed] = useState<RevealedSet>(new Set());
  const [scores, setScores] = useState<ScoreMap>(() => {
    if (!initialSubmissions) return {};
    const m: ScoreMap = {};
    for (const s of initialSubmissions) {
      // Keep the best score per card.
      const existing = m[s.cardId];
      if (!existing || existing.awardedPoints < s.awardedPoints) {
        m[s.cardId] = {
          matches: s.matches,
          activityScore: s.activityScore,
          locationScore: s.locationScore,
          awardedPoints: s.awardedPoints,
          distanceMeters: s.distanceMeters,
          photoLocation: null,
          reasoning: s.reasoning,
        };
      }
    }
    return m;
  });
  const [uploading, setUploading] = useState<{ cardId: string } | null>(null);

  const handleAddPin = useCallback(
    (latlng: LatLng) => {
      if (playMode) return;
      const id = makeId();
      setPins((prev) => [...prev, { id, name: "", lat: latlng.lat, lng: latlng.lng }]);
      setActivePinId(id);
    },
    [playMode],
  );
  const handleMovePin = useCallback(
    (id: string, latlng: LatLng) => {
      if (playMode) return;
      setPins((prev) =>
        prev.map((p) => (p.id === id ? { ...p, lat: latlng.lat, lng: latlng.lng } : p)),
      );
    },
    [playMode],
  );
  const handleSelectPin = useCallback((id: string) => setActivePinId(id), []);

  const handleRenamePin = (id: string, name: string) =>
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  const handleDeletePin = (id: string) => {
    setPins((prev) => prev.filter((p) => p.id !== id));
    if (activePinId === id) setActivePinId(null);
  };
  const movePinUp = (id: string) =>
    setPins((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  const movePinDown = (id: string) =>
    setPins((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1 || idx === prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });

  const handleGenerate = async () => {
    if (pins.length < 1 || vibe.trim().length < 5) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vibe,
          stops: pins.map((p) => ({ name: p.name, lat: p.lat, lng: p.lng })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message ?? body.error ?? `Failed (${res.status})`);
      }
      const { slug } = (await res.json()) as { slug: string };
      router.push(`/trip/${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setGenerating(false);
    }
  };

  const totalScore = useMemo(
    () => Object.values(scores).reduce((sum, s) => sum + s.awardedPoints, 0),
    [scores],
  );

  const activeIdx = activePinId ? pins.findIndex((p) => p.id === activePinId) : -1;
  const activePin = activeIdx >= 0 ? pins[activeIdx] : null;
  const activeStop = playMode && activeIdx >= 0 ? initialTrip!.stops[activeIdx] : null;

  const uploadingCard = useMemo(() => {
    if (!uploading || !initialTrip) return null;
    for (const s of initialTrip.stops) {
      const c = s.cards.find((c) => c.id === uploading.cardId);
      if (c) return { card: c, stop: s };
    }
    return null;
  }, [uploading, initialTrip]);

  return (
    <main className="grid h-screen w-screen grid-cols-1 bg-stone-100 dark:bg-stone-950 md:grid-cols-[1fr_28rem]">
      {/* Map */}
      <div className="relative h-full min-h-0">
        {apiKey ? (
          <EditableMap
            apiKey={apiKey}
            pins={pins}
            activePinId={activePinId}
            editable={!playMode}
            onAddPin={handleAddPin}
            onMovePin={handleMovePin}
            onSelectPin={handleSelectPin}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-stone-500">
            Map disabled — add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local and restart.
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-6">
          <Link
            href="/"
            className="pointer-events-auto rounded-2xl bg-white/85 px-4 py-2 text-sm font-semibold tracking-tight shadow-lg backdrop-blur dark:bg-stone-900/85 dark:text-stone-50"
          >
            wanderdeck
          </Link>
          {playMode && (
            <div className="pointer-events-auto rounded-2xl bg-white/85 px-4 py-2 shadow-lg backdrop-blur dark:bg-stone-900/85">
              <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Score</p>
              <p className="text-xl font-semibold text-stone-900 dark:text-stone-50">{totalScore}</p>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <aside className="flex h-full flex-col overflow-hidden border-t border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 md:border-l md:border-t-0">
        {!playMode ? (
          <BuilderSidebar
            pins={pins}
            activePinId={activePinId}
            vibe={vibe}
            generating={generating}
            error={error}
            onSelectPin={setActivePinId}
            onRenamePin={handleRenamePin}
            onDeletePin={handleDeletePin}
            onMoveUp={movePinUp}
            onMoveDown={movePinDown}
            onVibeChange={setVibe}
            onGenerate={handleGenerate}
          />
        ) : (
          <PlayerSidebar
            pins={pins}
            stops={initialTrip!.stops}
            activePin={activePin}
            activeStop={activeStop}
            revealed={revealed}
            scores={scores}
            onSelectPin={setActivePinId}
            onReveal={(cardId) =>
              setRevealed((r) => {
                const next = new Set(r);
                next.add(cardId);
                return next;
              })
            }
            onSubmitPhoto={(cardId) => setUploading({ cardId })}
          />
        )}
      </aside>

      <PhotoUploadModal
        open={uploading !== null}
        onClose={() => setUploading(null)}
        onScored={(result) => {
          if (!uploading) return;
          setScores((s) => {
            const existing = s[uploading.cardId];
            if (existing && existing.awardedPoints >= result.awardedPoints) return s;
            return { ...s, [uploading.cardId]: result };
          });
          setUploading(null);
        }}
        cardId={uploading?.cardId ?? null}
        cardSummary={
          uploadingCard
            ? {
                title: uploadingCard.card.title,
                revealedDescription: uploadingCard.card.revealedDescription,
                basePoints: uploadingCard.card.basePoints,
                stopName: uploadingCard.stop.name,
              }
            : null
        }
      />
    </main>
  );
}

// =============================================================
// Builder sidebar
// =============================================================

function BuilderSidebar({
  pins,
  activePinId,
  vibe,
  generating,
  error,
  onSelectPin,
  onRenamePin,
  onDeletePin,
  onMoveUp,
  onMoveDown,
  onVibeChange,
  onGenerate,
}: {
  pins: Pin[];
  activePinId: string | null;
  vibe: string;
  generating: boolean;
  error: string | null;
  onSelectPin: (id: string) => void;
  onRenamePin: (id: string, name: string) => void;
  onDeletePin: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onVibeChange: (v: string) => void;
  onGenerate: () => void;
}) {
  const canGenerate = pins.length >= 1 && vibe.trim().length >= 5 && !generating;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-stone-200 px-6 py-5 dark:border-stone-800">
        <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Build your trip</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          Drop pins, then tell us the vibe.
        </h1>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {pins.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-400">
            Tap anywhere on the map to drop a stop. Add as many as you like — the more specific, the
            better the cards.
          </p>
        ) : (
          <ol className="space-y-2">
            {pins.map((pin, i) => (
              <li
                key={pin.id}
                className={`group flex items-center gap-2 rounded-2xl border p-2 pl-3 transition ${
                  pin.id === activePinId
                    ? "border-stone-900 bg-stone-50 dark:border-stone-50 dark:bg-stone-950"
                    : "border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectPin(pin.id)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white dark:bg-stone-50 dark:text-stone-900"
                  aria-label={`Focus stop ${i + 1}`}
                >
                  {i + 1}
                </button>
                <input
                  value={pin.name}
                  onChange={(e) => onRenamePin(pin.id, e.target.value)}
                  onFocus={() => onSelectPin(pin.id)}
                  placeholder="Name this stop (optional)"
                  className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm text-stone-900 placeholder-stone-400 outline-none dark:text-stone-50"
                />
                <div className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => onMoveUp(pin.id)}
                    disabled={i === 0}
                    className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-30 dark:hover:bg-stone-800"
                    aria-label="Move up"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 15l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveDown(pin.id)}
                    disabled={i === pins.length - 1}
                    className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-30 dark:hover:bg-stone-800"
                    aria-label="Move down"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeletePin(pin.id)}
                    className="rounded-md p-1 text-stone-400 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950/40"
                    aria-label="Delete stop"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-stone-500">
            Your vibe
          </label>
          <textarea
            value={vibe}
            onChange={(e) => onVibeChange(e.target.value)}
            rows={4}
            placeholder="e.g. slow road trip, weird roadside attractions, good coffee, no tourist traps"
            className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-950 dark:text-stone-50"
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}
      </div>

      <footer className="border-t border-stone-200 px-6 py-4 dark:border-stone-800">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate}
          className="w-full rounded-full bg-stone-900 py-3 text-sm font-medium text-white transition disabled:opacity-50 dark:bg-stone-50 dark:text-stone-900"
        >
          {generating ? "Generating cards…" : "Generate cards"}
        </button>
        {generating && (
          <p className="mt-2 text-center text-xs text-stone-500">
            Claude is working — usually 20–40 seconds.
          </p>
        )}
      </footer>
    </div>
  );
}

// =============================================================
// Player sidebar
// =============================================================

function PlayerSidebar({
  pins,
  stops,
  activePin,
  activeStop,
  revealed,
  scores,
  onSelectPin,
  onReveal,
  onSubmitPhoto,
}: {
  pins: Pin[];
  stops: StoredTrip["stops"];
  activePin: Pin | null;
  activeStop: StoredTrip["stops"][number] | null;
  revealed: RevealedSet;
  scores: ScoreMap;
  onSelectPin: (id: string) => void;
  onReveal: (cardId: string) => void;
  onSubmitPhoto: (cardId: string) => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex gap-1 overflow-x-auto border-b border-stone-200 px-3 py-3 dark:border-stone-800">
        {pins.map((pin, i) => {
          const stopScore = stops[i].cards.reduce(
            (sum, card) => sum + (scores[card.id]?.awardedPoints ?? 0),
            0,
          );
          const isActive = pin.id === activePin?.id;
          return (
            <button
              key={pin.id}
              type="button"
              onClick={() => onSelectPin(pin.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                isActive
                  ? "bg-stone-900 text-white dark:bg-stone-50 dark:text-stone-900"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300"
              }`}
            >
              <span>
                {i + 1}. {stops[i].name}
              </span>
              {stopScore > 0 && (
                <span className="rounded-full bg-emerald-500/20 px-1.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                  {stopScore}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {activePin && activeStop ? (
          <>
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
              Stop {activeStop.sequence + 1}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
              {activeStop.name}
            </h2>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
              {activeStop.description}
            </p>

            <div className="mt-5 space-y-3">
              {activeStop.cards.map((card) => (
                <Card
                  key={card.id}
                  card={card}
                  stopLocation={{ lat: activePin.lat, lng: activePin.lng }}
                  revealed={revealed.has(card.id)}
                  score={scores[card.id]}
                  onReveal={() => onReveal(card.id)}
                  onPhoto={() => onSubmitPhoto(card.id)}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-stone-500">Select a stop to see its cards.</p>
        )}
      </div>

      <footer className="border-t border-stone-200 px-6 py-4 dark:border-stone-800">
        <Link
          href="/plan"
          className="block w-full rounded-full border border-stone-300 py-2.5 text-center text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          Plan a new trip
        </Link>
      </footer>
    </div>
  );
}

// =============================================================
// Card with geo-gated reveal
// =============================================================

function Card({
  card,
  stopLocation,
  revealed,
  score,
  onReveal,
  onPhoto,
}: {
  card: StoredTrip["stops"][number]["cards"][number];
  stopLocation: LatLng;
  revealed: boolean;
  score?: ScoreResult;
  onReveal: () => void;
  onPhoto: () => void;
}) {
  const [gate, setGate] = useState<
    | { status: "idle" }
    | { status: "checking" }
    | { status: "too-far"; distanceMeters: number }
    | { status: "no-location"; reason: string }
  >({ status: "idle" });

  const handleRevealClick = () => {
    if (!("geolocation" in navigator)) {
      setGate({ status: "no-location", reason: "Geolocation isn't available on this device." });
      return;
    }
    setGate({ status: "checking" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const d = haversineMeters(here, stopLocation);
        if (d <= REVEAL_RADIUS_M) {
          onReveal();
        } else {
          setGate({ status: "too-far", distanceMeters: d });
        }
      },
      () => {
        setGate({
          status: "no-location",
          reason: "Location permission denied. You can reveal anyway, but photos won't score.",
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  if (!revealed) {
    if (gate.status === "too-far") {
      const dist =
        gate.distanceMeters > 1000
          ? `${(gate.distanceMeters / 1000).toFixed(1)} km`
          : `${Math.round(gate.distanceMeters)} m`;
      return (
        <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">
            Not close enough yet
          </p>
          <p className="mt-2 text-base italic text-stone-700 dark:text-stone-300">
            &ldquo;{card.hiddenHint}&rdquo;
          </p>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            You&rsquo;re about <strong>{dist}</strong> away. Get within {REVEAL_RADIUS_M}m of the
            stop to flip this card.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleRevealClick}
              className="rounded-full border border-amber-700/40 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-300/40 dark:text-amber-200 dark:hover:bg-amber-900/40"
            >
              Check again
            </button>
            <button
              type="button"
              onClick={onReveal}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-amber-900/70 underline-offset-2 hover:underline dark:text-amber-200/70"
            >
              Reveal anyway (won&rsquo;t score)
            </button>
          </div>
        </div>
      );
    }

    if (gate.status === "no-location") {
      return (
        <div className="rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 p-5 dark:border-stone-700 dark:bg-stone-950">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-400">Hidden card</p>
          <p className="mt-2 text-base italic text-stone-700 dark:text-stone-300">
            &ldquo;{card.hiddenHint}&rdquo;
          </p>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">{gate.reason}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleRevealClick}
              className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={onReveal}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-stone-500 underline-offset-2 hover:underline"
            >
              Reveal anyway
            </button>
          </div>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={handleRevealClick}
        disabled={gate.status === "checking"}
        className="group block w-full rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 p-5 text-left transition hover:border-stone-500 hover:bg-stone-100 disabled:opacity-60 dark:border-stone-700 dark:bg-stone-950 dark:hover:bg-stone-800"
      >
        <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
          {gate.status === "checking" ? "Checking your location…" : "Hidden card · tap when you arrive"}
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
      <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">{card.revealedDescription}</p>
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
        Activity {Math.round(score.activityScore * 100)}% · Location {Math.round(score.locationScore * 100)}% ·{" "}
        {distance}
      </p>
      <p className="mt-2 text-xs text-stone-700 dark:text-stone-300">{score.reasoning}</p>
    </div>
  );
}
