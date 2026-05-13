import { NextRequest } from "next/server";
import { z } from "zod";
import { generateItinerary } from "@/lib/ai/claude";

const Body = z.object({
  prompt: z.string().min(10),
  origin: z.string().min(1),
  destination: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await generateItinerary(parsed.data);
  const text = result.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return Response.json({ raw: text });
}
