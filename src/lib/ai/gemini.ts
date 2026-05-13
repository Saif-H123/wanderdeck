import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

const MODEL = "gemini-2.5-flash";

/**
 * Cheap first-pass image classification before sending to Claude for scoring.
 * Filters out obvious non-matches (blurry, wrong subject) to save Claude calls.
 */
export async function classifyPhoto(input: {
  imageBase64: string;
  mimeType: string;
  expectedSubject: string;
}) {
  const response = await client.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: input.imageBase64, mimeType: input.mimeType } },
          {
            text: `Does this photo plausibly contain: "${input.expectedSubject}"? Reply only with JSON: { plausible: boolean, blurry: boolean, subject_guess: string }`,
          },
        ],
      },
    ],
  });
  return response;
}
