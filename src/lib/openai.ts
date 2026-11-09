import { createOpenAI } from "@ai-sdk/openai";
import { generateImage, generateText } from "ai";
import { modelId } from "./validation";
import type { Generation } from "./engine";

export class OpenAIConfigurationError extends Error {
  constructor() {
    super(
      "Add OPENAI_API_KEY as a Secret in this project's Vercel environment variables, then redeploy. For local development, add it to .env.local.",
    );
    this.name = "OpenAIConfigurationError";
  }
}

export function createOpenAIProvider(
  apiKey = process.env.OPENAI_API_KEY,
  fetchImplementation?: typeof globalThis.fetch,
) {
  if (!apiKey?.trim()) throw new OpenAIConfigurationError();
  return createOpenAI({ apiKey: apiKey.trim(), fetch: fetchImplementation });
}

export async function generateOpenAIStep(
  openai: ReturnType<typeof createOpenAIProvider>,
  options: {
    identifier: string;
    outputType: "text" | "image";
    prompt: string;
    system: string;
    inputImage: Uint8Array | null;
    abortSignal: AbortSignal;
  },
): Promise<Generation> {
  const { identifier, outputType, prompt, system, inputImage, abortSignal } =
    options;
  if (outputType === "image") {
    const instruction = [system, prompt].filter(Boolean).join("\n\n");
    const result = await generateImage({
      model: openai.image(modelId(identifier)),
      prompt: inputImage
        ? { text: instruction, images: [inputImage] }
        : instruction,
      size: "1024x1024",
      n: 1,
      providerOptions: { openai: { quality: "low", outputFormat: "png" } },
      abortSignal,
      maxRetries: 0,
    });
    return {
      text: "",
      images: result.images.map((image) => ({
        data: image.uint8Array,
        mediaType: image.mediaType,
      })),
    };
  }
  const result = await generateText({
    model: openai.responses(modelId(identifier)),
    system: system || undefined,
    messages: [
      {
        role: "user",
        content: inputImage
          ? [
              { type: "text", text: prompt },
              { type: "file", data: inputImage, mediaType: "image" },
            ]
          : [{ type: "text", text: prompt }],
      },
    ],
    maxOutputTokens: 2048,
    providerOptions: { openai: { store: false, reasoningEffort: "minimal" } },
    abortSignal,
    maxRetries: 0,
  });
  return { text: result.text, images: [] };
}
