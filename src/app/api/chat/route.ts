import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-opus-4-7";

const ChatTurnSchema = z.object({
  assistantMessage: z
    .string()
    .describe("Your next message in the conversation. Conversational, concise, not a survey."),
  readyToGenerate: z
    .boolean()
    .describe(
      "True when you have enough to generate personalized activity cards. Set to true if the user explicitly asks to generate.",
    ),
});

export type ChatTurn = z.infer<typeof ChatTurnSchema>;

const CHAT_SYSTEM = `You are helping a user plan a trip by chatting briefly before activity cards are generated for each of their pinned stops.

Your job:
1. Ask 1-3 targeted questions to understand the kind of trip they want — pace, vibe, who's going, must-haves, things to avoid. Reference their pins where useful.
2. Keep it conversational and warm. Not a survey. Don't repeat back what they said.
3. When you have enough to generate meaningful, personalized cards, set readyToGenerate: true with a short, friendly "ready when you are" message.
4. Don't ask about logistics (dates, hotels, transport). Focus on character and feel.
5. If the user types "go", "generate", "ready", "do it", or similar, immediately mark readyToGenerate: true.

If the user has no pins yet, gently steer them to drop some first, but still chat.`;

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .min(1),
  pins: z.array(
    z.object({
      name: z.string(),
      caption: z.string().nullable().optional(),
      lat: z.number(),
      lng: z.number(),
    }),
  ),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { messages, pins } = parsed.data;

  const pinsContext =
    pins.length === 0
      ? "\n\nThe user hasn't dropped any pins yet."
      : `\n\nThe user's pins:\n${pins
          .map((p, i) => `${i + 1}. ${p.name || "(unnamed)"} — ${p.caption ?? "no region info"}`)
          .join("\n")}`;

  try {
    const result = await client.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      system: CHAT_SYSTEM + pinsContext,
      output_config: {
        effort: "low",
        format: zodOutputFormat(ChatTurnSchema),
      },
      messages,
    });
    if (!result.parsed_output) {
      return Response.json({ error: "Model returned malformed output" }, { status: 502 });
    }
    return Response.json(result.parsed_output);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
