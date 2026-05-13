import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-opus-4-7";

/**
 * Generates a structured itinerary from a free-form user description.
 * Claude is used here for the reasoning step (route planning, picking activities
 * that match the user's vibe); Gemini handles cheaper bulk tasks.
 */
export async function generateItinerary(input: {
  prompt: string;
  origin: string;
  destination: string;
}) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system:
      "You are a travel itinerary designer. Given a user's free-form description of their ideal trip and an origin + destination, return a JSON object with stops along the route and 2-4 hidden 'activity cards' per stop. Each card has a vague hint (what the user sees before picking it up) and a revealed description (what they see after).",
    messages: [
      {
        role: "user",
        content: `Origin: ${input.origin}\nDestination: ${input.destination}\n\nUser description: ${input.prompt}\n\nReturn JSON only.`,
      },
    ],
  });
  return response;
}

/**
 * Scores a user-submitted photo against an activity card's criteria.
 * Returns a structured judgement (matches, confidence, points).
 */
export async function scorePhoto(input: {
  imageBase64: string;
  mimeType: string;
  card: { title: string; scoringCriteria: string; basePoints: number };
}) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      "You judge whether a user-submitted photo satisfies an activity card's scoring criteria. Be encouraging but honest. Award 0-100% of base points based on how well the photo matches.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: input.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: input.imageBase64,
            },
          },
          {
            type: "text",
            text: `Card: ${input.card.title}\nCriteria: ${input.card.scoringCriteria}\nBase points: ${input.card.basePoints}\n\nReturn JSON: { matches: boolean, confidence: number (0-1), awardedPoints: number, reasoning: string }`,
          },
        ],
      },
    ],
  });
  return response;
}
