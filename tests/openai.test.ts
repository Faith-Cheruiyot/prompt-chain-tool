import test from "node:test";
import assert from "node:assert/strict";
import {
  createOpenAIProvider,
  generateOpenAIStep,
  OpenAIConfigurationError,
} from "../src/lib/openai";
import { defaultModel, modelId, modelProvider } from "../src/lib/validation";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
  "base64",
);
const options = {
  identifier: "openai/gpt-6-luna",
  outputType: "text" as const,
  prompt: "Describe this image.",
  system: "Be concise.",
  inputImage: null as Uint8Array | null,
  temperature: null,
  abortSignal: AbortSignal.timeout(10000),
};

test("OpenAI models are preferred for new text and image steps", () => {
  const models = [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-image",
    "gpt-6-luna",
    "gpt-image-2.5-flare",
  ].map((model_identifier) => ({ model_identifier }));
  assert.equal(defaultModel(models, "text")?.model_identifier, "gpt-6-luna");
  assert.equal(
    defaultModel(models, "image")?.model_identifier,
    "gpt-image-2.5-flare",
  );
  assert.equal(modelId("openai/gpt-6-luna"), "gpt-6-luna");
  assert.equal(modelProvider("google/gemini-3.5-flash-lite"), "google");
  assert.equal(modelProvider("openai/gpt-6-luna"), "openai");
});

test("an empty OpenAI key fails without sending any request", () => {
  assert.throws(() => createOpenAIProvider("  "), OpenAIConfigurationError);
});

test("text and vision use the direct OpenAI Responses API with private credentials", async () => {
  const openai = createOpenAIProvider("test-openai-key", async (url, init) => {
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      "Bearer test-openai-key",
    );
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "gpt-6-luna");
    assert.equal(body.store, false);
    assert.equal(body.reasoning.effort, "none");
    assert.doesNotMatch(String(init?.body), /test-openai-key/);
    assert.match(JSON.stringify(body.input), /data:image\/png;base64,/);
    return Response.json({
      id: "resp_test",
      object: "response",
      created_at: 1,
      model: "gpt-6-luna",
      status: "completed",
      output: [
        {
          id: "msg_test",
          type: "message",
          role: "assistant",
          status: "completed",
          content: [
            { type: "output_text", text: "An orange cat.", annotations: [] },
          ],
        },
      ],
      usage: { input_tokens: 12, output_tokens: 4, total_tokens: 16 },
    });
  });
  const result = await generateOpenAIStep(openai, {
    ...options,
    inputImage: png,
  });
  assert.equal(result.text, "An orange cat.");
  assert.deepEqual(result.images, []);
});

test("image generation uses the Images API and returns private storage bytes", async () => {
  const openai = createOpenAIProvider("test-openai-key", async (url, init) => {
    assert.equal(String(url), "https://api.openai.com/v1/images/generations");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "gpt-image-2.5-flare");
    assert.equal(body.n, 1);
    assert.equal(body.size, "1024x1024");
    assert.match(body.prompt, /Be concise/);
    assert.equal(body.output_format, "png");
    return Response.json({
      created: 1,
      data: [{ b64_json: png.toString("base64") }],
    });
  });
  const result = await generateOpenAIStep(openai, {
    ...options,
    identifier: "gpt-image-2.5-flare",
    outputType: "image",
  });
  assert.equal(result.images[0].mediaType, "image/png");
  assert.deepEqual(result.images[0].data, new Uint8Array(png));
});

test("an existing image is passed to OpenAI edits for later image steps", async () => {
  const openai = createOpenAIProvider("test-openai-key", async (url, init) => {
    assert.equal(String(url), "https://api.openai.com/v1/images/edits");
    assert.ok(init?.body instanceof FormData);
    assert.equal(init.body.get("model"), "gpt-image-2.5-flare");
    const files = [...init.body.values()].filter(
      (value) => value instanceof Blob,
    );
    assert.equal(files.length, 1);
    assert.deepEqual(
      new Uint8Array(await files[0].arrayBuffer()),
      new Uint8Array(png),
    );
    return Response.json({
      created: 1,
      data: [{ b64_json: png.toString("base64") }],
    });
  });
  const result = await generateOpenAIStep(openai, {
    ...options,
    identifier: "gpt-image-2.5-flare",
    outputType: "image",
    inputImage: png,
  });
  assert.equal(result.images.length, 1);
});
