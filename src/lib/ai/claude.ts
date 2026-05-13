import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-opus-4-7";

const PlanSchema = z.object({
  stops: z
    .array(
      z.object({
        name: z.string().describe("Short, recognisable name for the stop."),
        description: z
          .string()
          .describe("One or two sentences on why we're stopping here, tuned to the user's vibe."),
        location: z.object({
          lat: z.number().min(-90).max(90),
          lng: z.number().min(-180).max(180),
        }),
        arrivalEstimate: z
          .string()
          .describe('Loose ETA from origin, e.g. "~2h drive" or "afternoon".'),
        cards: z
          .array(
            z.object({
              title: z.string().describe("Short title for the activity (3-6 words)."),
              hiddenHint: z
                .string()
                .describe(
                  "The pre-reveal teaser — vague, evocative, no spoilers (e.g. 'something cold and blue').",
                ),
              revealedDescription: z
                .string()
                .describe("The full activity, revealed after the player picks up the card."),
              scoringCriteria: z
                .string()
                .describe(
                  "Concrete photo criteria the AI will judge against (e.g. 'a clear shot of the glacier with the player or a personal object visible in-frame').",
                ),
              basePoints: z.number().int().min(50).max(500),
            }),
          )
          .min(2)
          .max(4),
      }),
    )
    .min(2)
    .max(6),
});

export type GeneratedPlan = z.infer<typeof PlanSchema>;

const PLAN_SYSTEM = `You design opinionated travel itineraries with a "hidden activity card" game layer.

For each trip:
- Pick 2-6 stops between origin and destination that match the user's vibe. Order them by sensible travel sequence.
- For each stop, write 2-4 activity cards. Each card has:
  - A vague, evocative \`hiddenHint\` (what the player sees on the back of the card — no spoilers).
  - A clear \`revealedDescription\` (what the activity actually is).
  - \`scoringCriteria\` — concrete things the photo must show for it to score (subject, framing, anything specific). The criteria is used by an AI image grader, so be precise about what counts.
  - \`basePoints\` — 50-500. Harder, more distinctive activities score higher.

Latitude/longitude must be real coordinates accurate to within a few hundred meters of the actual stop — the game grades players on physical proximity.

Activities should feel handmade for this user's prompt, not generic "see the famous tower". Lean into the specific.`;

export async function generateItinerary(input: {
  prompt: string;
  origin: string;
  destination: string;
}) {
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
        content: `Origin: ${input.origin}\nDestination: ${input.destination}\n\nUser's vibe / what they want from this trip:\n${input.prompt}`,
      },
    ],
  });
  return result;
}

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
- Confidence reflects how clearly the criteria are met. 0.7+ for solid, 0.4-0.7 for "close enough", below 0.4 means it's borderline.
- Calibrate to the criteria. Hard, specific criteria deserve higher bars than vague ones.`;

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
