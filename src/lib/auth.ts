import "server-only";
import { createClient, configured } from "@/lib/supabase/server";

export class AccessError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function requireAdmin() {
  if (!configured())
    throw new AccessError("Connect Supabase to finish setup.", 503);
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new AccessError("Sign in to continue.", 401);
  const [{ data: profile }, { data: access, error: accessError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("first_name,last_name,is_superadmin")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.rpc("admin_access"),
    ]);
  // admin_access also enforces the Humor Project's Google OAuth and session rules.
  if (profile?.is_superadmin !== true || accessError || access !== true) {
    throw new AccessError(
      "This workspace is available to superadmins signed in with Google.",
      403,
    );
  }
  return { supabase, user, profile };
}
export function apiError(error: unknown) {
  if (error instanceof AccessError)
    return Response.json({ error: error.message }, { status: error.status });
  return Response.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}
