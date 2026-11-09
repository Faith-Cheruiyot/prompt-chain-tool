/** Translate provider failures without exposing provider responses or credentials. */
export function generationErrorMessage(
  error: unknown,
  position: number,
  timedOut: boolean,
  provider: "openai" | "google" = "google",
) {
  if (timedOut) return "This run reached its time limit. Try fewer steps.";

  let statusCode: unknown = null;
  const details: string[] = [];
  let current = error;
  // Image generation can wrap the underlying HTTP failure in an SDK error.
  for (
    let depth = 0;
    depth < 5 && current && typeof current === "object";
    depth++
  ) {
    if ("statusCode" in current && statusCode === null)
      statusCode = current.statusCode;
    if (current instanceof Error) details.push(current.message);
    current = "cause" in current ? current.cause : null;
  }
  const diagnostic = details.join(" ");
  if (provider === "openai") {
    if (
      statusCode === 401 ||
      /invalid_api_key|Incorrect API key/i.test(diagnostic)
    )
      return "OpenAI rejected the API key. Check OPENAI_API_KEY in this Vercel project's environment variables and redeploy.";
    if (
      statusCode === 402 ||
      /insufficient_quota|exceeded your current quota/i.test(diagnostic)
    )
      return "OpenAI API quota or credits are exhausted. Check billing and project limits in the OpenAI developer platform, then retry.";
    if (statusCode === 403)
      return "OpenAI denied this request. Check the key's project permissions and access to the selected model in the OpenAI developer platform.";
    if (statusCode === 404)
      return "This model is unavailable for your OpenAI API key. Choose another supported model, then retry.";
    if (statusCode === 429)
      return "OpenAI's rate limit was reached. Wait a moment, then retry.";
    return `Step ${position} could not finish. Check OpenAI model access and API configuration, then retry.`;
  }
  if (/API_KEY_(INVALID|EXPIRED)|API key (not valid|expired)/i.test(diagnostic))
    return "Gemini rejected the API key. Check GEMINI_API_KEY in this Vercel project's environment variables and redeploy.";
  switch (statusCode) {
    case 401:
      return "Gemini could not authenticate this run. Check GEMINI_API_KEY in this Vercel project's environment variables and redeploy.";
    case 403:
      return "Gemini denied this request. Check the API key's permissions, API restrictions, and access to the selected model in Google AI Studio.";
    case 404:
      return "This model is unavailable for your Gemini API key. Choose another supported model, then retry.";
    case 429:
      return "Gemini's rate limit or quota was reached. Check the key's usage in Google AI Studio, wait a moment, then retry.";
    default:
      return `Step ${position} could not finish. Check Gemini model access and API configuration, then retry.`;
  }
}
