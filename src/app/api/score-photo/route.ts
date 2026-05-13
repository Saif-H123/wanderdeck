import { NextRequest } from "next/server";
import { z } from "zod";
import exifr from "exifr";
import { classifyPhoto } from "@/lib/ai/gemini";
import { scorePhoto } from "@/lib/ai/claude";
import { bestDistanceMeters, computeAwardedPoints, gradeActivity } from "@/lib/scoring";
import { supabaseServer } from "@/lib/db/supabase";
import { recordSubmission } from "@/lib/db/trips";
import { getCurrentUser } from "@/lib/auth";

export const maxDuration = 60;

const LatLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const Body = z.object({
  cardId: z.string().uuid(),
  imageBase64: z.string().min(1),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  uploadLocation: LatLng.nullable(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { cardId, imageBase64, mimeType, uploadLocation } = parsed.data;

  // Fetch the card and its stop from the DB. Single source of truth for
  // criteria + location — clients can't fake scoring by sending different
  // criteria than what was stored.
  const sb = supabaseServer();
  const { data: card, error: cardErr } = await sb
    .from("activity_cards")
    .select("id, title, scoring_criteria, base_points, stop_id, trip_stops(lat, lng)")
    .eq("id", cardId)
    .maybeSingle();
  if (cardErr) return Response.json({ error: cardErr.message }, { status: 500 });
  if (!card) return Response.json({ error: "Card not found" }, { status: 404 });

  const stopJoin = (card.trip_stops as unknown) as { lat: number; lng: number } | null;
  if (!stopJoin) return Response.json({ error: "Stop not found for card" }, { status: 500 });
  const stop = { lat: Number(stopJoin.lat), lng: Number(stopJoin.lng) };

  // EXIF GPS extraction.
  const imageBuffer = Buffer.from(imageBase64, "base64");
  const exifGps = await exifr.gps(imageBuffer).catch(() => null);
  const photoLocation =
    exifGps && typeof exifGps.latitude === "number" && typeof exifGps.longitude === "number"
      ? { lat: exifGps.latitude, lng: exifGps.longitude }
      : null;

  const distanceMeters = bestDistanceMeters({
    stop,
    upload: uploadLocation,
    photo: photoLocation,
  });

  // Cheap first-pass: Gemini reject for obvious wrong-subject photos.
  const firstPass = await classifyPhoto({
    imageBase64,
    mimeType,
    expectedSubject: card.title,
  }).catch(() => null);

  let activityScore = 0;
  let matches = false;
  let reasoning = "";

  if (firstPass?.text?.toLowerCase().includes('"plausible": false')) {
    reasoning = "Quick first-pass: the photo doesn't appear to show the expected subject.";
  } else {
    const judgement = await scorePhoto({
      imageBase64,
      mimeType,
      card: {
        title: card.title,
        scoringCriteria: card.scoring_criteria,
        basePoints: card.base_points,
      },
    }).catch(() => null);

    if (!judgement?.parsed_output) {
      return Response.json({ error: "Scoring model returned malformed output" }, { status: 502 });
    }
    const j = judgement.parsed_output;
    const graded = gradeActivity({ matches: j.matches, confidence: j.confidence });
    activityScore = graded.activityScore;
    matches = graded.matches;
    reasoning = j.reasoning;
  }

  const { awardedPoints, locationScore } = computeAwardedPoints({
    basePoints: card.base_points,
    activityScore,
    distanceMeters,
  });

  // Persist the submission + upload photo.
  try {
    const user = await getCurrentUser();
    const stored = await recordSubmission({
      cardId,
      userId: user?.id ?? null,
      matches: matches && awardedPoints > 0,
      activityScore,
      locationScore,
      awardedPoints,
      distanceMeters,
      uploadLat: uploadLocation?.lat ?? null,
      uploadLng: uploadLocation?.lng ?? null,
      photoLat: photoLocation?.lat ?? null,
      photoLng: photoLocation?.lng ?? null,
      reasoning,
      imageBuffer,
      mimeType,
    });

    return Response.json({
      submissionId: stored.submissionId,
      matches: matches && awardedPoints > 0,
      activityScore,
      locationScore,
      awardedPoints,
      distanceMeters,
      photoLocation,
      reasoning,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
