import test from "node:test";
import assert from "node:assert/strict";
import { generationErrorMessage } from "../src/lib/generation-error";

test("Gemini key and permission failures explain distinct fixes", () => {
  assert.match(
    generationErrorMessage({ statusCode: 401 }, 1, false),
    /GEMINI_API_KEY/,
  );
  const invalidKey = Object.assign(
    new Error("API key not valid. Private provider response."),
    { statusCode: 400 },
  );
  const message = generationErrorMessage(invalidKey, 1, false);
  assert.match(message, /GEMINI_API_KEY/);
  assert.doesNotMatch(message, /Private provider response/);
  assert.match(
    generationErrorMessage({ statusCode: 403 }, 1, false),
    /Google AI Studio/,
  );
});

test("model availability and quota failures have actionable Gemini messages", () => {
  assert.match(
    generationErrorMessage({ statusCode: 404 }, 1, false),
    /another/,
  );
  assert.match(generationErrorMessage({ statusCode: 429 }, 1, false), /quota/);
});

test("timeouts and unexpected failures do not expose raw errors", () => {
  assert.match(generationErrorMessage(null, 2, true), /time limit/);
  assert.equal(
    generationErrorMessage(new Error("secret provider details"), 2, false),
    "Step 2 could not finish. Check Gemini model access and API configuration, then retry.",
  );
});
