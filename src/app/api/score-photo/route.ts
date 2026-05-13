import { NextRequest } from "next/server";
import { z } from "zod";
import exifr from "exifr";
import { classifyPhoto } from "@/lib/ai/gemini";
import { scorePhoto } from "@/lib/ai/claude";
import { bestDistanceMeters, computeAwardedPoints, gradeActivity } from "@/lib/scoring";

export const maxDuration = 60;

const LatLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const Body = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  card: z.object({
    title: z.string(),
    scoringCriteria: z.string(),
    basePoints: z.number().int().positive(),
  }),
  stop: LatLng,
  uploadLocation: LatLng.nullable(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { imageBase64, mimeType, card, stop, uploadLocation } = parsed.data;

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

  // Cheap first-pass: if Gemini is confident the photo isn't the right
  // subject, skip the (more expensive) Claude judgement.
  const firstPass = await classifyPhoto({
    imageBase64,
    mimeType,
    expectedSubject: card.title,
  }).catch(() => null);
  if (firstPass?.text?.toLowerCase().includes('"plausible": false')) {
    const { awardedPoints, locationScore } = computeAwardedPoints({
      basePoints: card.basePoints,
      activityScore: 0,
      distanceMeters,
    });
    return Response.json({
      matches: false,
      activityScore: 0,
      locationScore,
      awardedPoints,
      distanceMeters,
      photoLocation,
      reasoning: "Quick first-pass: the photo doesn't appear to show the expected subject.",
    });
  }

  let judgement;
  try {
    judgement = await scorePhoto({ imageBase64, mimeType, card });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }

  if (!judgement.parsed_output) {
    return Response.json(
      { error: "Model returned malformed judgement", stopReason: judgement.stop_reason },
      { status: 502 },
    );
  }

  const { matches: claudeMatches, confidence, reasoning } = judgement.parsed_output;
  const { activityScore, matches } = gradeActivity({
    matches: claudeMatches,
    confidence,
  });
  const { awardedPoints, locationScore } = computeAwardedPoints({
    basePoints: card.basePoints,
    activityScore,
    distanceMeters,
  });

  return Response.json({
    matches: matches && awardedPoints > 0,
    activityScore,
    locationScore,
    awardedPoints,
    distanceMeters,
    photoLocation,
    reasoning,
  });
}
