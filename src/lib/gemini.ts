import { createGoogle } from "@ai-sdk/google";

export class GeminiConfigurationError extends Error {
  constructor() {
    super(
      "Add GEMINI_API_KEY to this project's Vercel environment variables, then redeploy. For local development, add it to .env.local.",
    );
    this.name = "GeminiConfigurationError";
  }
}

/** Use the same server-only key name as the Humor Project. */
export function createGeminiProvider(
  apiKey = process.env.GEMINI_API_KEY,
  fetchImplementation?: typeof globalThis.fetch,
) {
  if (!apiKey?.trim()) throw new GeminiConfigurationError();
  return createGoogle({ apiKey: apiKey.trim(), fetch: fetchImplementation });
}
