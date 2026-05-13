import { NextRequest } from "next/server";
import { z } from "zod";
import { generateActivityCards } from "@/lib/ai/claude";
import { createTrip } from "@/lib/db/trips";
import { getCurrentUser } from "@/lib/auth";

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
    const plan = result.parsed_output;
    const user = await getCurrentUser();
    const { slug } = await createTrip({
      vibe: parsed.data.vibe,
      pins: parsed.data.stops,
      plan,
      userId: user?.id ?? null,
    });
    return Response.json({ slug, plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
