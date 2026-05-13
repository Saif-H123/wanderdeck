"use client";

import { useEffect, useState } from "react";
import type { LatLng } from "@/lib/types";

export type ScoreResult = {
  matches: boolean;
  activityScore: number;
  locationScore: number;
  awardedPoints: number;
  distanceMeters: number | null;
  photoLocation: LatLng | null;
  reasoning: string;
};

export function PhotoUploadModal({
  open,
  onClose,
  onScored,
  cardId,
  cardSummary,
}: {
  open: boolean;
  onClose: () => void;
  onScored: (result: ScoreResult) => void;
  cardId: string | null;
  cardSummary: {
    title: string;
    revealedDescription: string;
    basePoints: number;
    stopName: string;
  } | null;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadLocation, setUploadLocation] = useState<LatLng | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setUploadLocation(null);
      setGeoStatus("idle");
      setError(null);
    }
  }, [open]);

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setGeoStatus("denied");
      setError("Geolocation isn't available on this device.");
      return;
    }
    setGeoStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUploadLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("granted");
      },
      () => {
        setGeoStatus("denied");
        setError("Location denied. Without it your photo will score zero.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleSubmit() {
    if (!file || !cardId) return;
    setSubmitting(true);
    setError(null);

    try {
      const imageBase64 = await fileToBase64(file);
      const mimeType = file.type as "image/jpeg" | "image/png" | "image/webp";

      const res = await fetch("/api/score-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId,
          imageBase64,
          mimeType,
          uploadLocation,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Scoring failed (${res.status})`);
      }
      const result = (await res.json()) as ScoreResult;
      onScored(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !cardId || !cardSummary) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-stone-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-stone-900">
        <div className="border-b border-stone-200 p-6 dark:border-stone-800">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
            {cardSummary.stopName}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-stone-900 dark:text-stone-50">
            {cardSummary.title}
          </h2>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            {cardSummary.revealedDescription}
          </p>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-500">
              1. Share your location
            </p>
            <button
              type="button"
              onClick={requestLocation}
              disabled={geoStatus === "granted" || geoStatus === "requesting"}
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-900 transition hover:border-stone-400 disabled:opacity-60 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-50"
            >
              {geoStatus === "idle" && "Use my current location"}
              {geoStatus === "requesting" && "Asking your browser…"}
              {geoStatus === "granted" && uploadLocation && (
                <>Got it: {uploadLocation.lat.toFixed(4)}, {uploadLocation.lng.toFixed(4)}</>
              )}
              {geoStatus === "denied" && "Location denied — tap to try again"}
            </button>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-500">
              2. Add a photo
            </p>
            <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-sm text-stone-600 transition hover:border-stone-400 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-400">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              {preview ? (
                <img src={preview} alt="preview" className="max-h-48 rounded-lg object-cover" />
              ) : (
                <>
                  <span className="text-2xl">📷</span>
                  <span>Tap to take or choose a photo</span>
                </>
              )}
            </label>
          </div>

          {error && (
            <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-full border border-stone-300 py-3 text-sm font-medium text-stone-700 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !file}
              className="flex-1 rounded-full bg-stone-900 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-stone-50 dark:text-stone-900"
            >
              {submitting ? "Scoring…" : "Submit for scoring"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return reject(new Error("Bad file read"));
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}
