import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${url.origin}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });
  return NextResponse.redirect(
    !error && data.url
      ? data.url
      : new URL("/login?error=provider", request.url),
  );
}
