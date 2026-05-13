// Location grade: full credit within FULL_CREDIT_M of the stop, linear
// decay to zero at ZERO_CREDIT_M, hard zero beyond. This is what enforces
// "you have to actually go there" — no location, no points.
const FULL_CREDIT_M = 200;
const ZERO_CREDIT_M = 2_000;

// Activity grade is lenient on purpose — the game is about getting to the
// stop and snapping *something* relevant, not photographic perfection.
// Anything Claude marks as a match gets at least this much credit.
export const ACTIVITY_MATCH_THRESHOLD = 0.35;
const ACTIVITY_FLOOR_ON_MATCH = 0.7;

export function gradeActivity(input: {
  matches: boolean;
  confidence: number;
}): { activityScore: number; matches: boolean } {
  const conf = clamp01(input.confidence);
  const matched = input.matches && conf >= ACTIVITY_MATCH_THRESHOLD;
  if (!matched) return { activityScore: 0, matches: false };
  return { activityScore: Math.max(ACTIVITY_FLOOR_ON_MATCH, conf), matches: true };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function locationFactor(distanceMeters: number | null): number {
  if (distanceMeters === null) return 0;
  if (distanceMeters <= FULL_CREDIT_M) return 1;
  if (distanceMeters >= ZERO_CREDIT_M) return 0;
  return (ZERO_CREDIT_M - distanceMeters) / (ZERO_CREDIT_M - FULL_CREDIT_M);
}

/**
 * Final award. Activity-match alone cannot earn points — both signals
 * must clear. activityScore: how well the photo satisfies the card
 * (0-1). distanceMeters: distance from the stop, or null if no location
 * data was provided at all (which we treat as cheating).
 */
export function computeAwardedPoints(input: {
  basePoints: number;
  activityScore: number;
  distanceMeters: number | null;
}): { awardedPoints: number; locationScore: number } {
  const locScore = locationFactor(input.distanceMeters);
  const awarded = Math.round(
    input.basePoints * input.activityScore * locScore,
  );
  return { awardedPoints: awarded, locationScore: locScore };
}

/**
 * Pick the best location signal we have for grading. Both signals
 * (browser geo at upload + EXIF GPS in photo) are valid evidence the
 * user was at the place — we use whichever is *closer* to the stop,
 * which rewards the "I was actually there" case even if one signal is
 * missing or noisy. Returns null only when neither signal exists.
 */
export function bestDistanceMeters(input: {
  stop: { lat: number; lng: number };
  upload: { lat: number; lng: number } | null;
  photo: { lat: number; lng: number } | null;
}): number | null {
  const candidates: number[] = [];
  if (input.upload) {
    candidates.push(haversineDistance(input.stop, input.upload));
  }
  if (input.photo) {
    candidates.push(haversineDistance(input.stop, input.photo));
  }
  return candidates.length === 0 ? null : Math.min(...candidates);
}

// Re-export so scoring callers don't need a second import.
import { haversineMeters as haversineDistance } from "./geo";
export { haversineDistance };
