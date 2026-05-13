import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-opus-4-7";

// =============================================================
// Itinerary card generation (pin-driven flow)
// =============================================================

const CardSchema = z.object({
  title: z.string().describe("Short title for the activity (3-6 words)."),
  hiddenHint: z
    .string()
    .describe(
      "The pre-reveal teaser. Vague, evocative, no spoilers. Example: 'something cold and blue'.",
    ),
  revealedDescription: z
    .string()
    .describe("The full activity, revealed after the player picks up the card."),
  scoringCriteria: z
    .string()
    .describe(
      "Concrete photo criteria the AI grader will judge against. Be precise about what must be in the frame.",
    ),
  basePoints: z.number().int().min(50).max(500),
});

const StopWithCardsSchema = z.object({
  placeName: z
    .string()
    .describe(
      "Identify what's actually at this lat/lng — a named place, neighbourhood, landmark, or rough description (e.g. 'Forest near Loch Ness'). Use the user-provided name if it's already specific.",
    ),
  description: z
    .string()
    .describe("One or two sentences on the character of this spot, tuned to the user's vibe."),
  cards: z.array(CardSchema).min(2).max(4),
});

const PlanSchema = z.object({
  stops: z.array(StopWithCardsSchema).min(1).max(8),
});

export type GeneratedPlan = z.infer<typeof PlanSchema>;
export type GeneratedStop = z.infer<typeof StopWithCardsSchema>;

const PLAN_SYSTEM = `You are designing activity cards for a trip where the user has already chosen the stops by dropping pins on a map.

For each stop:
- Identify what's actually at the lat/lng (use the user's name if given, or your own knowledge of the location).
- Write a short description that captures the character of the spot, tuned to the user's vibe.
- Generate 2-4 activity cards. Each card has:
  - A short title (3-6 words).
  - A vague, evocative \`hiddenHint\` (what the player sees before they pick the card up). No spoilers.
  - A clear \`revealedDescription\` (what the activity actually is).
  - \`scoringCriteria\` — concrete things the photo must show. An AI image grader will judge against this, so be precise.
  - \`basePoints\` — 50-500. Harder, more distinctive activities score higher.

Activities should feel handmade for this user's vibe, not generic tourist stuff. Lean into the specific. The number and order of stops in your output must match the input exactly.`;

export async function generateActivityCards(input: {
  vibe: string;
  stops: { name: string; lat: number; lng: number }[];
}) {
  const stopList = input.stops
    .map((s, i) => `${i + 1}. "${s.name || "(unnamed)"}" at lat=${s.lat.toFixed(5)}, lng=${s.lng.toFixed(5)}`)
    .join("\n");

  const result = await client.messages.parse({
    model: MODEL,
    max_tokens: 8192,
    thinking: { type: "adaptive" },
    system: PLAN_SYSTEM,
    output_config: {
      effort: "high",
      format: zodOutputFormat(PlanSchema),
    },
    messages: [
      {
        role: "user",
        content: `User's vibe:\n${input.vibe}\n\nStops (in order):\n${stopList}\n\nGenerate the activity cards.`,
      },
    ],
  });
  return result;
}

// =============================================================
// Photo scoring (unchanged from before)
// =============================================================

const PhotoJudgementSchema = z.object({
  matches: z
    .boolean()
    .describe("Does the photo plausibly satisfy the card's scoring criteria?"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("How confident you are. 0 = clearly wrong, 1 = nailed it."),
  reasoning: z
    .string()
    .describe(
      "One or two sentences explaining the judgement — what you saw, what worked or didn't.",
    ),
});

export type PhotoJudgement = z.infer<typeof PhotoJudgementSchema>;

const SCORE_SYSTEM = `You grade whether a user-submitted photo satisfies an activity card's scoring criteria.

Be encouraging but honest:
- If the right subject is clearly in the frame, mark matches=true even if the photo isn't perfect — composition, lighting, and amateur framing should not punish the player.
- If the photo is the wrong subject entirely, or shows none of the criteria, mark matches=false.
- Confidence reflects how clearly the criteria are met. 0.7+ for solid, 0.4-0.7 for "close enough", below 0.4 means it's borderline.`;

export async function scorePhoto(input: {
  imageBase64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  card: { title: string; scoringCriteria: string; basePoints: number };
}) {
  const result = await client.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    system: SCORE_SYSTEM,
    output_config: {
      effort: "low",
      format: zodOutputFormat(PhotoJudgementSchema),
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: input.mimeType,
              data: input.imageBase64,
            },
          },
          {
            type: "text",
            text: `Card: ${input.card.title}\nScoring criteria: ${input.card.scoringCriteria}\nBase points: ${input.card.basePoints}\n\nJudge the photo against the criteria.`,
          },
        ],
      },
    ],
  });
  return result;
}
