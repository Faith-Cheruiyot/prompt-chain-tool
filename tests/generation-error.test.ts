import test from "node:test";
import assert from "node:assert/strict";
import { generationErrorMessage } from "../src/lib/generation-error";

test("OpenAI authentication, access, and rate-limit failures explain distinct fixes", () => {
  assert.match(
    generationErrorMessage({ statusCode: 401 }, 1, false),
    /OPENAI_API_KEY/,
  );
  assert.match(
    generationErrorMessage({ statusCode: 403 }, 1, false),
    /OpenAI.*permissions/,
  );
  assert.match(
    generationErrorMessage({ statusCode: 404 }, 1, false),
    /OpenAI API key/,
  );
  assert.match(
    generationErrorMessage({ statusCode: 429 }, 1, false),
    /rate limit/,
  );
});

test("wrapped quota failures explain billing without exposing provider details", () => {
  const quota = Object.assign(
    new Error("insufficient_quota: private provider response"),
    { statusCode: 429 },
  );
  const wrapped = new Error("Image generation failed", { cause: quota });
  const message = generationErrorMessage(wrapped, 1, false);
  assert.match(message, /OpenAI.*credits/);
  assert.doesNotMatch(message, /private provider response/);
});

test("timeouts and unexpected failures do not expose raw errors", () => {
  assert.match(generationErrorMessage(null, 2, true), /time limit/);
  assert.equal(
    generationErrorMessage(new Error("secret provider details"), 2, false),
    "Step 2 could not finish. Check OpenAI model access and API configuration, then retry.",
  );
});
