import { AccessError } from "./auth";
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw new AccessError("Invalid request origin.", 403);
}
