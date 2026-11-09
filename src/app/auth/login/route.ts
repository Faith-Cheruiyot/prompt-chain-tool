import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authOrigin } from "@/lib/auth-origin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = authOrigin(request.url, process.env.APP_URL);
  // Redirect before creating the Supabase client: its PKCE cookie must be set
  // on the same host that will receive the callback, including from preview URLs.
  if (url.origin !== origin) {
    return NextResponse.redirect(new URL("/auth/login", origin));
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });
  return NextResponse.redirect(
    !error && data.url
      ? data.url
      : new URL("/login?error=provider", request.url),
  );
}
