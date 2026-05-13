import { customAlphabet } from "nanoid";
import { supabaseServer } from "./supabase";
import type { GeneratedPlan } from "@/lib/ai/claude";

// URL-safe slug — 8 chars, no ambiguous chars.
const makeSlug = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 8);

type CreateInput = {
  vibe: string;
  pins: { name: string; lat: number; lng: number }[];
  plan: GeneratedPlan;
};

export type StoredTrip = {
  id: string;
  slug: string;
  vibe: string;
  createdAt: string;
  stops: StoredStop[];
};

export type StoredStop = {
  id: string;
  sequence: number;
  name: string;
  description: string;
  lat: number;
  lng: number;
  cards: StoredCard[];
};

export type StoredCard = {
  id: string;
  title: string;
  hiddenHint: string;
  revealedDescription: string;
  scoringCriteria: string;
  basePoints: number;
};

export type StoredSubmission = {
  id: string;
  cardId: string;
  matches: boolean;
  activityScore: number;
  locationScore: number;
  awardedPoints: number;
  distanceMeters: number | null;
  photoPath: string;
  reasoning: string;
  submittedAt: string;
};

/**
 * Persist a generated plan to Supabase. Returns the slug for the new trip.
 * One trip + N stops + N*M cards inserted; rolls back on any error.
 */
export async function createTrip({ vibe, pins, plan }: CreateInput): Promise<{ slug: string }> {
  if (pins.length !== plan.stops.length) {
    throw new Error("pins.length must match plan.stops.length");
  }
  const sb = supabaseServer();

  const slug = makeSlug();
  const { data: trip, error: tripErr } = await sb
    .from("trips")
    .insert({
      slug,
      prompt: vibe,
      status: "planning",
      origin_label: pins[0]?.name || plan.stops[0]?.placeName || "",
      origin_lat: pins[0]?.lat ?? 0,
      origin_lng: pins[0]?.lng ?? 0,
      destination_label:
        pins[pins.length - 1]?.name || plan.stops[plan.stops.length - 1]?.placeName || "",
      destination_lat: pins[pins.length - 1]?.lat ?? 0,
      destination_lng: pins[pins.length - 1]?.lng ?? 0,
    })
    .select("id, slug")
    .single();
  if (tripErr || !trip) throw new Error(`Failed to insert trip: ${tripErr?.message}`);

  // Insert stops in order, then cards per stop.
  const stopRows = plan.stops.map((s, i) => ({
    trip_id: trip.id,
    sequence: i,
    name: pins[i].name || s.placeName,
    description: s.description,
    lat: pins[i].lat,
    lng: pins[i].lng,
  }));
  const { data: insertedStops, error: stopsErr } = await sb
    .from("trip_stops")
    .insert(stopRows)
    .select("id, sequence");
  if (stopsErr || !insertedStops) {
    await sb.from("trips").delete().eq("id", trip.id);
    throw new Error(`Failed to insert stops: ${stopsErr?.message}`);
  }

  const stopIdBySeq = new Map<number, string>();
  for (const s of insertedStops) stopIdBySeq.set(s.sequence, s.id);

  const cardRows = plan.stops.flatMap((stop, i) =>
    stop.cards.map((card) => ({
      stop_id: stopIdBySeq.get(i)!,
      title: card.title,
      hidden_hint: card.hiddenHint,
      revealed_description: card.revealedDescription,
      scoring_criteria: card.scoringCriteria,
      base_points: card.basePoints,
    })),
  );

  const { error: cardsErr } = await sb.from("activity_cards").insert(cardRows);
  if (cardsErr) {
    await sb.from("trips").delete().eq("id", trip.id);
    throw new Error(`Failed to insert cards: ${cardsErr.message}`);
  }

  return { slug: trip.slug };
}

/**
 * Fetch a trip by slug, including stops, cards, and any submissions.
 */
export async function getTripBySlug(
  slug: string,
): Promise<{ trip: StoredTrip; submissions: StoredSubmission[] } | null> {
  const sb = supabaseServer();

  const { data: trip, error: tripErr } = await sb
    .from("trips")
    .select("id, slug, prompt, created_at")
    .eq("slug", slug)
    .maybeSingle();
  if (tripErr) throw new Error(tripErr.message);
  if (!trip) return null;

  const { data: stops, error: stopsErr } = await sb
    .from("trip_stops")
    .select("id, sequence, name, description, lat, lng")
    .eq("trip_id", trip.id)
    .order("sequence", { ascending: true });
  if (stopsErr) throw new Error(stopsErr.message);

  const stopIds = (stops ?? []).map((s) => s.id);
  const { data: cards, error: cardsErr } = await sb
    .from("activity_cards")
    .select(
      "id, stop_id, title, hidden_hint, revealed_description, scoring_criteria, base_points, created_at",
    )
    .in("stop_id", stopIds.length ? stopIds : [""])
    .order("created_at", { ascending: true });
  if (cardsErr) throw new Error(cardsErr.message);

  const cardIds = (cards ?? []).map((c) => c.id);
  const { data: subs, error: subsErr } = await sb
    .from("card_submissions")
    .select(
      "id, card_id, matches, activity_score, location_score, awarded_points, distance_meters, photo_path, ai_reasoning, submitted_at",
    )
    .in("card_id", cardIds.length ? cardIds : [""])
    .order("submitted_at", { ascending: false });
  if (subsErr) throw new Error(subsErr.message);

  const cardsByStop = new Map<string, StoredCard[]>();
  for (const c of cards ?? []) {
    const arr = cardsByStop.get(c.stop_id) ?? [];
    arr.push({
      id: c.id,
      title: c.title,
      hiddenHint: c.hidden_hint,
      revealedDescription: c.revealed_description,
      scoringCriteria: c.scoring_criteria,
      basePoints: c.base_points,
    });
    cardsByStop.set(c.stop_id, arr);
  }

  const storedStops: StoredStop[] = (stops ?? []).map((s) => ({
    id: s.id,
    sequence: s.sequence,
    name: s.name,
    description: s.description,
    lat: Number(s.lat),
    lng: Number(s.lng),
    cards: cardsByStop.get(s.id) ?? [],
  }));

  const submissions: StoredSubmission[] = (subs ?? []).map((s) => ({
    id: s.id,
    cardId: s.card_id,
    matches: s.matches,
    activityScore: Number(s.activity_score ?? 0),
    locationScore: Number(s.location_score ?? 0),
    awardedPoints: s.awarded_points,
    distanceMeters: s.distance_meters == null ? null : Number(s.distance_meters),
    photoPath: s.photo_path,
    reasoning: s.ai_reasoning,
    submittedAt: s.submitted_at,
  }));

  return {
    trip: {
      id: trip.id,
      slug: trip.slug,
      vibe: trip.prompt,
      createdAt: trip.created_at,
      stops: storedStops,
    },
    submissions,
  };
}

/**
 * Insert a card_submission row + upload the photo bytes to the
 * card-photos storage bucket. Path is `submissions/<submission-id>.<ext>`.
 */
export async function recordSubmission(input: {
  cardId: string;
  matches: boolean;
  activityScore: number;
  locationScore: number;
  awardedPoints: number;
  distanceMeters: number | null;
  uploadLat: number | null;
  uploadLng: number | null;
  photoLat: number | null;
  photoLng: number | null;
  reasoning: string;
  imageBuffer: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}): Promise<{ submissionId: string; photoPath: string }> {
  const sb = supabaseServer();
  const ext = input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";

  // Insert with a placeholder path first, get the id, then upload + update.
  const { data: row, error: insertErr } = await sb
    .from("card_submissions")
    .insert({
      card_id: input.cardId,
      photo_path: "pending",
      matches: input.matches,
      confidence: input.activityScore,
      activity_score: input.activityScore,
      location_score: input.locationScore,
      awarded_points: input.awardedPoints,
      ai_reasoning: input.reasoning,
      upload_lat: input.uploadLat,
      upload_lng: input.uploadLng,
      photo_lat: input.photoLat,
      photo_lng: input.photoLng,
      distance_meters: input.distanceMeters,
    })
    .select("id")
    .single();
  if (insertErr || !row) throw new Error(`Submission insert failed: ${insertErr?.message}`);

  const photoPath = `submissions/${row.id}.${ext}`;
  const { error: uploadErr } = await sb.storage
    .from("card-photos")
    .upload(photoPath, input.imageBuffer, { contentType: input.mimeType, upsert: true });
  if (uploadErr) {
    // Roll back the row if upload failed — the bucket path wouldn't resolve.
    await sb.from("card_submissions").delete().eq("id", row.id);
    throw new Error(`Photo upload failed: ${uploadErr.message}`);
  }

  await sb.from("card_submissions").update({ photo_path: photoPath }).eq("id", row.id);

  return { submissionId: row.id, photoPath };
}
