import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    return new Response("Forbidden", { status: 403 });
  await (await createClient()).auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
