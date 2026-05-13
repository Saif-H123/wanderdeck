import { NextRequest } from "next/server";
import { z } from "zod";
import { generateItinerary } from "@/lib/ai/claude";

export const maxDuration = 120;

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

  try {
    const result = await generateItinerary(parsed.data);
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
