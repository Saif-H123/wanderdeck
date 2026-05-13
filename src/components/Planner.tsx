"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type ChatMessage = { role: "user" | "assistant"; content: string };

type CostLeg = {
  index: number;
  fromAirport: { iata: string; city: string; country: string } | null;
  toAirport: { iata: string; city: string; country: string } | null;
  status: "estimated" | "no-offers" | "no-airport" | "drivable" | "error";
  distanceKm: number;
  price: number | null;
  currency: string | null;
  carrier: string | null;
  message?: string;
};

type CostEstimate = {
  legs: CostLeg[];
  total: number | null;
  currency: string | null;
  departureDate: string;
};

const OPENER: ChatMessage = {
  role: "assistant",
  content:
    "What's this trip about? Tell me the vibe — who's going, what kind of pace, anything you really don't want.",
};

export function Planner({
  apiKey,
  initialTrip,
  initialSubmissions,
  userMenu,
}: {
  apiKey: string | null;
  initialTrip?: StoredTrip;
  initialSubmissions?: StoredSubmission[];
  userMenu?: React.ReactNode;
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
  const [messages, setMessages] = useState<ChatMessage[]>([OPENER]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatReady, setChatReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cost estimate is fetched (debounced) whenever pins change.
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);
  const [costLoading, setCostLoading] = useState(false);

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

  // Debounced cost estimate. Re-runs when the relevant pin coordinates
  // change (we depend on a hash of lat/lng pairs to avoid re-firing on
  // unrelated state churn like rename).
  const pinKey = pins.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|");
  useEffect(() => {
    if (playMode) return;
    if (pins.length < 2) {
      setCostEstimate(null);
      return;
    }
    const handle = setTimeout(() => {
      setCostLoading(true);
      fetch("/api/cost-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pins: pins.map((p) => ({ lat: p.lat, lng: p.lng })),
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: CostEstimate | null) => setCostEstimate(data))
        .catch(() => setCostEstimate(null))
        .finally(() => setCostLoading(false));
    }, 1200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinKey, playMode]);

  const handleAddPin = useCallback(
    (latlng: LatLng) => {
      if (playMode) return;
      const id = makeId();
      setPins((prev) => [
        ...prev,
        { id, name: "", caption: null, lat: latlng.lat, lng: latlng.lng },
      ]);
      setActivePinId(id);

      // Reverse-geocode in the background to pre-fill the name + caption.
      void fetch(`/api/geocode?lat=${latlng.lat}&lng=${latlng.lng}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { name?: string; caption?: string } | null) => {
          if (!data) return;
          setPins((prev) =>
            prev.map((p) =>
              p.id === id
                ? {
                    ...p,
                    // Only overwrite name if user hasn't typed one yet.
                    name: p.name.trim() === "" ? (data.name ?? "") : p.name,
                    caption: data.caption ?? null,
                  }
                : p,
            ),
          );
        })
        .catch(() => {
          /* swallow — geocoder is best-effort */
        });
    },
    [playMode],
  );
  const handleMovePin = useCallback(
    (id: string, latlng: LatLng) => {
      if (playMode) return;
      setPins((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, lat: latlng.lat, lng: latlng.lng, caption: null } : p,
        ),
      );
      // Re-geocode at the new position.
      void fetch(`/api/geocode?lat=${latlng.lat}&lng=${latlng.lng}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { name?: string; caption?: string } | null) => {
          if (!data) return;
          setPins((prev) =>
            prev.map((p) =>
              p.id === id
                ? {
                    ...p,
                    name: p.name.trim() === "" ? (data.name ?? "") : p.name,
                    caption: data.caption ?? null,
                  }
                : p,
            ),
          );
        })
        .catch(() => {});
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

  const handleSendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || chatBusy) return;
    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setChatBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          pins: pins.map((p) => ({
            name: p.name,
            caption: p.caption ?? null,
            lat: p.lat,
            lng: p.lng,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message ?? body.error ?? `Chat failed (${res.status})`);
      }
      const { assistantMessage, readyToGenerate } = (await res.json()) as {
        assistantMessage: string;
        readyToGenerate: boolean;
      };
      setMessages((prev) => [...prev, { role: "assistant", content: assistantMessage }]);
      if (readyToGenerate) setChatReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setChatBusy(false);
    }
  };

  const handleGenerate = async () => {
    if (pins.length < 1) return;
    // Serialize transcript as the vibe input. Claude's chat questions are
    // preserved so generateActivityCards has full context for what the
    // user's answers meant.
    const vibe = messages
      .filter((m) => m !== OPENER || messages.length > 1) // skip the bare opener if untouched
      .map((m) => `${m.role === "user" ? "User" : "Planner"}: ${m.content}`)
      .join("\n");

    if (vibe.trim().length < 5) return;
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
            className="font-display pointer-events-auto rounded-2xl bg-white/85 px-4 py-2 text-base font-semibold tracking-tight shadow-lg backdrop-blur transition hover:bg-white dark:bg-stone-900/85 dark:text-stone-50"
          >
            wanderdeck
          </Link>
          <div className="flex items-start gap-3">
            {playMode && (
              <div className="pointer-events-auto rounded-2xl bg-white/85 px-4 py-2 shadow-lg backdrop-blur dark:bg-stone-900/85">
                <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Score</p>
                <p className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-50">
                  {totalScore}
                </p>
              </div>
            )}
            {userMenu && <div className="pointer-events-auto">{userMenu}</div>}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="flex h-full flex-col overflow-hidden border-t border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 md:border-l md:border-t-0">
        {!playMode ? (
          <BuilderSidebar
            pins={pins}
            activePinId={activePinId}
            messages={messages}
            chatBusy={chatBusy}
            chatReady={chatReady}
            generating={generating}
            error={error}
            costEstimate={costEstimate}
            costLoading={costLoading}
            onSelectPin={setActivePinId}
            onRenamePin={handleRenamePin}
            onDeletePin={handleDeletePin}
            onMoveUp={movePinUp}
            onMoveDown={movePinDown}
            onSendMessage={handleSendMessage}
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
  messages,
  chatBusy,
  chatReady,
  generating,
  error,
  costEstimate,
  costLoading,
  onSelectPin,
  onRenamePin,
  onDeletePin,
  onMoveUp,
  onMoveDown,
  onSendMessage,
  onGenerate,
}: {
  pins: Pin[];
  activePinId: string | null;
  messages: ChatMessage[];
  chatBusy: boolean;
  chatReady: boolean;
  generating: boolean;
  error: string | null;
  costEstimate: CostEstimate | null;
  costLoading: boolean;
  onSelectPin: (id: string) => void;
  onRenamePin: (id: string, name: string) => void;
  onDeletePin: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onSendMessage: (text: string) => void;
  onGenerate: () => void;
}) {
  const canGenerate = pins.length >= 1 && chatReady && !generating;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-stone-200 px-6 py-5 dark:border-stone-800">
        <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Build your trip</p>
        <h1 className="font-display mt-1 text-3xl font-semibold text-stone-900 dark:text-stone-50">
          Drop pins, then tell us the vibe.
        </h1>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {pins.length >= 2 && (
          <CostTotalRow estimate={costEstimate} loading={costLoading} />
        )}

        {pins.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-400">
            Tap anywhere on the map to drop a stop. Add as many as you like — the more specific, the
            better the cards.
          </p>
        ) : (
          <div className="space-y-2">
            {pins.map((pin, i) => (
              <div key={`group-${pin.id}`} className="space-y-2">
            <div
                key={pin.id}
                className={`group flex items-start gap-2 rounded-2xl border p-2 pl-3 transition ${
                  pin.id === activePinId
                    ? "border-stone-900 bg-stone-50 dark:border-stone-50 dark:bg-stone-950"
                    : "border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectPin(pin.id)}
                  className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white dark:bg-stone-50 dark:text-stone-900"
                  aria-label={`Focus stop ${i + 1}`}
                >
                  {i + 1}
                </button>
                <div className="min-w-0 flex-1">
                  <input
                    value={pin.name}
                    onChange={(e) => onRenamePin(pin.id, e.target.value)}
                    onFocus={() => onSelectPin(pin.id)}
                    placeholder={pin.name === "" && pin.caption === null ? "Finding place…" : "Name this stop"}
                    className="block w-full bg-transparent px-1 py-1 text-sm font-medium text-stone-900 placeholder-stone-400 outline-none dark:text-stone-50"
                  />
                  {pin.caption && (
                    <p className="px-1 text-xs italic text-stone-500">{pin.caption}</p>
                  )}
                </div>
                <div className="mt-1 flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
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
                </div>
                {i < pins.length - 1 && (
                  <CostBetweenRow
                    leg={costEstimate?.legs[i]}
                    loading={costLoading && !costEstimate}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <ChatPanel
          messages={messages}
          chatBusy={chatBusy}
          chatReady={chatReady}
          onSend={onSendMessage}
        />

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
        <p className="mt-2 text-center text-xs text-stone-500">
          {generating
            ? "Claude is working — usually 20–40 seconds."
            : pins.length === 0
              ? "Drop a pin to begin."
              : !chatReady
                ? "Tell us a bit more about the trip first."
                : "Ready when you are."}
        </p>
      </footer>
    </div>
  );
}

// =============================================================
// Chat panel — replaces the old vibe textarea
// =============================================================

function ChatPanel({
  messages,
  chatBusy,
  chatReady,
  onSend,
}: {
  messages: ChatMessage[];
  chatBusy: boolean;
  chatReady: boolean;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chatBusy]);

  const handleSend = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setDraft("");
  };

  return (
    <div>
      <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-stone-500">
        Tell us about the trip
      </label>
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-950">
        <div
          ref={scrollRef}
          className="max-h-72 space-y-2 overflow-y-auto px-3 py-3 text-sm"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 leading-relaxed ${
                  m.role === "user"
                    ? "bg-stone-900 text-white dark:bg-stone-50 dark:text-stone-900"
                    : "bg-white text-stone-800 shadow-sm dark:bg-stone-800 dark:text-stone-100"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {chatBusy && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-white px-3 py-2 shadow-sm dark:bg-stone-800">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400" />
                </span>
              </div>
            </div>
          )}
          {chatReady && !chatBusy && (
            <div className="flex justify-center">
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Ready to generate
              </span>
            </div>
          )}
        </div>
        <div className="border-t border-stone-200 bg-white p-2 dark:border-stone-800 dark:bg-stone-900">
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={chatBusy}
              placeholder={chatBusy ? "Thinking…" : "Type a reply…"}
              className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm text-stone-900 placeholder-stone-400 outline-none disabled:opacity-50 dark:text-stone-50"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={chatBusy || draft.trim() === ""}
              aria-label="Send"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-900 text-white transition hover:bg-stone-700 disabled:opacity-30 dark:bg-stone-50 dark:text-stone-900 dark:hover:bg-stone-200"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// Cost UI: total + per-leg rows
// =============================================================

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

function CostTotalRow({
  estimate,
  loading,
}: {
  estimate: CostEstimate | null;
  loading: boolean;
}) {
  if (!estimate && !loading) return null;
  return (
    <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-gradient-to-br from-stone-50 to-stone-100 px-4 py-3 dark:border-stone-800 dark:from-stone-900 dark:to-stone-950">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
          Estimated flights
        </p>
        <p className="font-display mt-0.5 text-2xl font-semibold text-stone-900 dark:text-stone-50">
          {loading && !estimate
            ? "…"
            : estimate?.total != null && estimate.currency
              ? formatMoney(estimate.total, estimate.currency)
              : "—"}
        </p>
      </div>
      <div className="text-right text-[10px] uppercase tracking-wider text-stone-400">
        <p>
          {estimate?.legs.filter((l) => l.status === "estimated").length ?? 0} priced legs
        </p>
        {estimate && (
          <p className="mt-0.5">
            Dep. {estimate.departureDate}
          </p>
        )}
      </div>
    </div>
  );
}

function CostBetweenRow({
  leg,
  loading,
}: {
  leg: CostLeg | undefined;
  loading: boolean;
}) {
  // Subtle divider style — sits between two pins.
  const base =
    "ml-3.5 flex items-center gap-3 border-l border-dashed border-stone-300 px-3 py-1.5 text-xs dark:border-stone-700";

  if (!leg && loading) {
    return (
      <div className={`${base} text-stone-400`}>
        <span className="inline-flex gap-0.5">
          <span className="h-1 w-1 animate-bounce rounded-full bg-stone-400 [animation-delay:-0.3s]" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-stone-400 [animation-delay:-0.15s]" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-stone-400" />
        </span>
        <span>Pricing leg…</span>
      </div>
    );
  }
  if (!leg) {
    return <div className={`${base} text-stone-400`}>—</div>;
  }

  switch (leg.status) {
    case "estimated":
      return (
        <div className={`${base} text-stone-700 dark:text-stone-300`}>
          <span className="text-stone-400">✈</span>
          <span>
            {leg.fromAirport?.iata} → {leg.toAirport?.iata}
          </span>
          <span className="ml-auto font-display text-sm font-semibold text-stone-900 dark:text-stone-50">
            {leg.price != null && leg.currency ? formatMoney(leg.price, leg.currency) : "—"}
          </span>
        </div>
      );
    case "drivable":
      return (
        <div className={`${base} text-stone-500`}>
          <span className="text-stone-400">🚗</span>
          <span>{leg.message}</span>
        </div>
      );
    case "no-offers":
      return (
        <div className={`${base} text-amber-700 dark:text-amber-300`}>
          <span>✈</span>
          <span>
            {leg.fromAirport?.iata}→{leg.toAirport?.iata}: no test offers
          </span>
        </div>
      );
    case "no-airport":
      return (
        <div className={`${base} text-stone-500`}>
          <span>?</span>
          <span>No major airport nearby</span>
        </div>
      );
    case "error":
      return (
        <div className={`${base} text-red-700 dark:text-red-300`}>
          <span>!</span>
          <span>{leg.message ?? "Pricing failed"}</span>
        </div>
      );
  }
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
            <div key={activePin.id} className="animate-fade-in-up">
              <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
                Stop {activeStop.sequence + 1}
              </p>
              <h2 className="font-display mt-1 text-3xl font-semibold text-stone-900 dark:text-stone-50">
                {activeStop.name}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                {activeStop.description}
              </p>
            </div>

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

  // Both faces render at all times — the parent rotates Y 180° when
  // `revealed` flips, and backface-visibility hides whichever face is
  // facing away. Grid keeps the two faces stacked in the same cell so
  // the wrapper sizes to the larger of the two.
  return (
    <div className="[perspective:1200px]">
      <div
        className={`grid w-full transition-transform duration-700 [transform-style:preserve-3d] ${
          revealed ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        {/* FRONT FACE — hidden card variants */}
        <div className="col-start-1 row-start-1 [backface-visibility:hidden]">
          <FrontFace card={card} gate={gate} onCheck={handleRevealClick} onForceReveal={onReveal} />
        </div>

        {/* BACK FACE — revealed card */}
        <div className="col-start-1 row-start-1 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <BackFace card={card} score={score} onPhoto={onPhoto} />
        </div>
      </div>
    </div>
  );
}

function FrontFace({
  card,
  gate,
  onCheck,
  onForceReveal,
}: {
  card: StoredTrip["stops"][number]["cards"][number];
  gate:
    | { status: "idle" }
    | { status: "checking" }
    | { status: "too-far"; distanceMeters: number }
    | { status: "no-location"; reason: string };
  onCheck: () => void;
  onForceReveal: () => void;
}) {
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
        <p className="mt-2 font-display text-lg italic text-stone-800 dark:text-stone-200">
          &ldquo;{card.hiddenHint}&rdquo;
        </p>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          You&rsquo;re about <strong>{dist}</strong> away. Get within {REVEAL_RADIUS_M}m of the stop
          to flip this card.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onCheck}
            className="rounded-full border border-amber-700/40 px-3 py-1.5 text-xs font-medium text-amber-900 transition hover:bg-amber-100 dark:border-amber-300/40 dark:text-amber-200 dark:hover:bg-amber-900/40"
          >
            Check again
          </button>
          <button
            type="button"
            onClick={onForceReveal}
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
        <p className="mt-2 font-display text-lg italic text-stone-800 dark:text-stone-200">
          &ldquo;{card.hiddenHint}&rdquo;
        </p>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">{gate.reason}</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onCheck}
            className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onForceReveal}
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
      onClick={onCheck}
      disabled={gate.status === "checking"}
      className="group relative flex h-full min-h-[220px] w-full flex-col justify-between overflow-hidden rounded-2xl border border-stone-300 bg-gradient-to-br from-stone-50 to-stone-100 p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-md disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm dark:border-stone-700 dark:from-stone-900 dark:to-stone-950 dark:hover:border-stone-500"
    >
      {/* Decorative pattern — a faint paper texture hinting "card back" */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(circle_at_20%_20%,rgba(120,113,108,0.22),transparent_45%),radial-gradient(circle_at_85%_85%,rgba(120,113,108,0.18),transparent_50%),repeating-linear-gradient(45deg,transparent,transparent_24px,rgba(120,113,108,0.06)_24px,rgba(120,113,108,0.06)_25px)]"
      />
      <p className="relative text-xs font-medium uppercase tracking-wider text-stone-500">
        {gate.status === "checking" ? "Checking your location…" : "Hidden · tap when you arrive"}
      </p>
      <p className="relative font-display text-xl italic leading-snug text-stone-800 dark:text-stone-200">
        &ldquo;{card.hiddenHint}&rdquo;
      </p>
      <p className="relative text-xs font-medium tracking-wide text-stone-500">
        {card.basePoints} pts
      </p>
    </button>
  );
}

function BackFace({
  card,
  score,
  onPhoto,
}: {
  card: StoredTrip["stops"][number]["cards"][number];
  score?: ScoreResult;
  onPhoto: () => void;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-950">
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-lg font-semibold text-stone-900 dark:text-stone-50">
          {card.title}
        </p>
        <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-400">
          {card.basePoints} pts
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
        {card.revealedDescription}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-stone-500">
        <span className="font-semibold uppercase tracking-wider">Photo brief:</span>{" "}
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
