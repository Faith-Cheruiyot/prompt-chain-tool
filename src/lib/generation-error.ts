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
  switch (statusCode) {
    case 401:
      return "AI Gateway could not authenticate this run. Check that OIDC is enabled for this Vercel project and redeploy. For local development, run vercel env pull or configure an AI Gateway key.";
    case 402:
      return "AI Gateway credits or budget are exhausted. Check the team's credits and project budget, then retry.";
    case 403:
      return error instanceof Error &&
        error.message.includes("customer_verification_required")
        ? "Vercel requires account verification before AI Gateway can run. Add a valid payment method in the team's Vercel billing settings, then retry."
        : "AI Gateway denied this request. Check the team's AI Gateway access, account verification, and model policies, then retry.";
    case 404:
      return "This model is unavailable on AI Gateway. Choose another supported model, then retry.";
    case 429:
      return "The model is busy. Wait a moment, then retry.";
    default:
      return `Step ${position} could not finish. Check model access and AI Gateway configuration, then retry.`;
  }
}
