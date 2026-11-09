import test from "node:test";
import assert from "node:assert/strict";
import { generationErrorMessage } from "../src/lib/generation-error";

test("authentication and account verification failures explain distinct fixes", () => {
  assert.match(generationErrorMessage({ statusCode: 401 }, 1, false), /OIDC/);
  const verification = Object.assign(
    new Error("customer_verification_required: private provider response"),
    { statusCode: 403 },
  );
  const message = generationErrorMessage(verification, 1, false);
  assert.match(message, /payment method/);
  assert.doesNotMatch(message, /private provider response/);
  assert.match(
    generationErrorMessage({ statusCode: 403 }, 1, false),
    /model policies/,
  );
});

test("quota, model availability, and rate limits have actionable messages", () => {
  assert.match(generationErrorMessage({ statusCode: 402 }, 1, false), /budget/);
  assert.match(
    generationErrorMessage({ statusCode: 404 }, 1, false),
    /another/,
  );
  assert.match(generationErrorMessage({ statusCode: 429 }, 1, false), /Wait/);
});

test("timeouts and unexpected failures do not expose raw errors", () => {
  assert.match(generationErrorMessage(null, 2, true), /time limit/);
  assert.equal(
    generationErrorMessage(new Error("secret provider details"), 2, false),
    "Step 2 could not finish. Check model access and AI Gateway configuration, then retry.",
  );
});
