import { NextRequest } from "next/server";
import { z } from "zod";
import { generateActivityCards } from "@/lib/ai/claude";

export const maxDuration = 120;

const Body = z.object({
  vibe: z.string().min(5),
  stops: z
    .array(
      z.object({
        name: z.string(),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      }),
    )
    .min(1)
    .max(8),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await generateActivityCards(parsed.data);
    if (!result.parsed_output) {
      return Response.json(
        { error: "Model returned malformed output", stopReason: result.stop_reason },
        { status: 502 },
      );
    }
    return Response.json({ plan: result.parsed_output });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
