import { requireAdmin, apiError } from "@/lib/auth";
import { sameOrigin } from "@/lib/http";
import { z } from "zod";
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    const { supabase } = await requireAdmin();
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      return Response.json({ error: "Invalid chain." }, { status: 400 });
    const { data, error } = await supabase
      .from("prompt_chains")
      .delete()
      .eq("id", id)
      .select("id")
      .single();
    if (error)
      return Response.json(
        {
          error:
            error.code === "23503"
              ? "This chain is referenced by another app. Set it to draft instead."
              : "Could not delete this chain.",
        },
        { status: 400 },
      );
    return Response.json(data);
  } catch (error) {
    return apiError(error);
  }
}
