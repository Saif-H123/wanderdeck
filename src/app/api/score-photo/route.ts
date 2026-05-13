import { NextRequest } from "next/server";
import { z } from "zod";
import exifr from "exifr";
import { classifyPhoto } from "@/lib/ai/gemini";
import { scorePhoto } from "@/lib/ai/claude";
import { bestDistanceMeters, computeAwardedPoints } from "@/lib/scoring";

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

type ClaudeJudgement = {
  matches?: boolean;
  confidence?: number;
  reasoning?: string;
};

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

  // Cheap first-pass: if Gemini is confident the photo isn't even
  // the right subject, skip the (more expensive) Claude judgement.
  const firstPass = await classifyPhoto({
    imageBase64,
    mimeType,
    expectedSubject: card.title,
  });
  const firstPassText = (firstPass.text ?? "").toLowerCase();
  if (firstPassText.includes('"plausible": false')) {
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
      reasoning: "First-pass classifier rejected: photo doesn't appear to show the expected subject.",
    });
  }

  // Activity grade from Claude vision.
  const judgement = await scorePhoto({ imageBase64, mimeType, card });
  const judgementText = judgement.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  const parsedJudgement = parseClaudeJson(judgementText);
  const activityScore = clamp01(parsedJudgement.confidence ?? 0);
  const matches = parsedJudgement.matches ?? activityScore >= 0.5;

  const { awardedPoints, locationScore } = computeAwardedPoints({
    basePoints: card.basePoints,
    activityScore: matches ? activityScore : 0,
    distanceMeters,
  });

  return Response.json({
    matches: matches && awardedPoints > 0,
    activityScore,
    locationScore,
    awardedPoints,
    distanceMeters,
    photoLocation,
    reasoning: parsedJudgement.reasoning ?? judgementText.slice(0, 500),
  });
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function parseClaudeJson(raw: string): ClaudeJudgement {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const firstBrace = body.indexOf("{");
  const lastBrace = body.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) return {};
  try {
    return JSON.parse(body.slice(firstBrace, lastBrace + 1));
  } catch {
    return {};
  }
}
