/** Keep the PKCE cookie and OAuth callback on the same configured app origin. */
export function authOrigin(requestUrl: string, appUrl?: string) {
  if (!appUrl?.trim()) return new URL(requestUrl).origin;

  const configured = new URL(appUrl.trim());
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(
    configured.hostname,
  );
  if (
    (configured.protocol !== "https:" &&
      !(local && configured.protocol === "http:")) ||
    configured.username ||
    configured.password ||
    configured.pathname !== "/" ||
    configured.search ||
    configured.hash
  ) {
    throw new Error(
      "APP_URL must be an HTTPS origin, or HTTP localhost for development.",
    );
  }
  return configured.origin;
}
