import test from "node:test";
import assert from "node:assert/strict";
import { generateText } from "ai";
import {
  createGeminiProvider,
  GeminiConfigurationError,
} from "../src/lib/gemini";
import {
  geminiModelId,
  imageModelIds,
  textModelIds,
} from "../src/lib/validation";

test("existing database model identifiers resolve to direct Gemini IDs", () => {
  for (const prefix of ["", "google/", "models/"]) {
    assert.ok(
      textModelIds.has(geminiModelId(`${prefix}gemini-3.5-flash-lite`)),
    );
    assert.ok(
      imageModelIds.has(geminiModelId(`${prefix}gemini-3.1-flash-image`)),
    );
  }
  assert.equal(
    textModelIds.has(geminiModelId("other/gemini-3.5-flash-lite")),
    false,
  );
});

test("a missing Gemini key fails before making a provider request", () => {
  assert.throws(() => createGeminiProvider("  "), GeminiConfigurationError);
});

test("text generation calls Google directly with the server-side key", async () => {
  const google = createGeminiProvider("test-gemini-key", async (url, init) => {
    assert.equal(
      String(url),
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
    );
    assert.equal(
      new Headers(init?.headers).get("x-goog-api-key"),
      "test-gemini-key",
    );
    assert.doesNotMatch(String(url), /test-gemini-key/);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.contents[0].parts[0].text, "Write one caption.");
    assert.doesNotMatch(String(init?.body), /test-gemini-key/);
    return Response.json({
      candidates: [
        {
          content: { role: "model", parts: [{ text: "Homework can wait." }] },
          finishReason: "STOP",
        },
      ],
      usageMetadata: {
        promptTokenCount: 5,
        candidatesTokenCount: 4,
        totalTokenCount: 9,
      },
    });
  });
  const result = await generateText({
    model: google(geminiModelId("google/gemini-3.5-flash-lite")),
    prompt: "Write one caption.",
    maxRetries: 0,
  });
  assert.equal(result.text, "Homework can wait.");
});

test("Gemini image requests preserve input images and return generated files", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const google = createGeminiProvider("test-gemini-key", async (url, init) => {
    assert.equal(
      String(url),
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent",
    );
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.generationConfig.responseModalities, [
      "TEXT",
      "IMAGE",
    ]);
    assert.equal(body.contents[0].parts[1].inlineData.data, "AQID");
    return Response.json({
      candidates: [
        {
          content: {
            role: "model",
            parts: [
              { text: "A funny cat." },
              { inlineData: { mimeType: "image/png", data: "AQID" } },
            ],
          },
          finishReason: "STOP",
        },
      ],
    });
  });
  const result = await generateText({
    model: google(geminiModelId("google/gemini-3.1-flash-image")),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Add sunglasses." },
          { type: "image", image: bytes, mediaType: "image/png" },
        ],
      },
    ],
    providerOptions: { google: { responseModalities: ["TEXT", "IMAGE"] } },
    maxRetries: 0,
  });
  assert.equal(result.text, "A funny cat.");
  assert.equal(result.files[0].mediaType, "image/png");
  assert.deepEqual(result.files[0].uint8Array, bytes);
});
