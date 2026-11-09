import { requireAdmin, apiError } from "@/lib/auth";
import { sameOrigin } from "@/lib/http";
import {
  chainSchema,
  checkReferences,
  gatewayModel,
  imageModelIds,
  textModelIds,
} from "@/lib/validation";

export async function GET() {
  try {
    const { supabase } = await requireAdmin();
    const { data, error } = await supabase
      .from("prompt_chains")
      .select("*,prompt_chain_steps(*)")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return Response.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { supabase } = await requireAdmin();
    const parsed = chainSchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    const chain = parsed.data;
    try {
      checkReferences(chain.steps);
    } catch (error) {
      return Response.json(
        { error: (error as Error).message },
        { status: 400 },
      );
    }
    if (chain.steps.length) {
      const { data: models, error } = await supabase
        .from("llm_models")
        .select("id,model_identifier")
        .eq("is_active", true);
      if (error) throw error;
      if (
        chain.steps.some((s) => {
          const model = models.find((m) => m.id === s.llm_model_id);
          return (
            !model ||
            !(s.output_type === "image" ? imageModelIds : textModelIds).has(
              gatewayModel(model.model_identifier),
            )
          );
        })
      )
        return Response.json(
          { error: "Select a supported model for every step." },
          { status: 400 },
        );
    }
    const { error } = await supabase.rpc("pc_save_chain", { payload: chain });
    if (error)
      return Response.json(
        {
          error:
            error.code === "40001"
              ? "This chain changed in another window. Reload before saving."
              : error.message,
        },
        { status: error.code === "40001" ? 409 : 400 },
      );
    const { data, error: readError } = await supabase
      .from("prompt_chains")
      .select("*,prompt_chain_steps(*)")
      .eq("id", chain.id)
      .single();
    if (readError) throw readError;
    return Response.json(data);
  } catch (error) {
    return apiError(error);
  }
}
