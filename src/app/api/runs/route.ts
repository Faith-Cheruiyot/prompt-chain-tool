import { requireAdmin, apiError } from "@/lib/auth";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const chain = new URL(request.url).searchParams.get("chain");
    if (chain && !z.uuid().safeParse(chain).success)
      return Response.json({ error: "Invalid chain." }, { status: 400 });
    let query = supabase
      .from("prompt_chain_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (chain) query = query.eq("prompt_chain_id", chain);
    const { data, error } = await query;
    if (error) throw error;
    return Response.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
