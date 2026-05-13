import { NextRequest } from "next/server";
import { z } from "zod";
import { classifyPhoto } from "@/lib/ai/gemini";
import { scorePhoto } from "@/lib/ai/claude";

const Body = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  card: z.object({
    title: z.string(),
    scoringCriteria: z.string(),
    basePoints: z.number().int().positive(),
  }),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { imageBase64, mimeType, card } = parsed.data;

  const firstPass = await classifyPhoto({
    imageBase64,
    mimeType,
    expectedSubject: card.title,
  });

  const firstPassText = firstPass.text ?? "";
  if (firstPassText.toLowerCase().includes('"plausible": false')) {
    return Response.json({
      matches: false,
      confidence: 0,
      awardedPoints: 0,
      reasoning: "Gemini first-pass: photo does not appear to contain the expected subject.",
    });
  }

  const judgement = await scorePhoto({ imageBase64, mimeType, card });
  const text = judgement.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  return Response.json({ raw: text });
}
