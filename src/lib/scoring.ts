// Location grade: full credit within FULL_CREDIT_M of the stop, linear
// decay to zero at ZERO_CREDIT_M, hard zero beyond. This is what enforces
// "you have to actually go there" — no location, no points.
const FULL_CREDIT_M = 200;
const ZERO_CREDIT_M = 2_000;

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
