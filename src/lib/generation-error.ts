/** Translate provider failures without exposing provider responses or credentials. */
export function generationErrorMessage(
  error: unknown,
  position: number,
  timedOut: boolean,
) {
  if (timedOut) return "This run reached its time limit. Try fewer steps.";

  const statusCode =
    error && typeof error === "object" && "statusCode" in error
      ? error.statusCode
      : null;
  if (
    error instanceof Error &&
    /API_KEY_(INVALID|EXPIRED)|API key (not valid|expired)/i.test(error.message)
  )
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
