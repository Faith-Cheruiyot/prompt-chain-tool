import { redirect } from "next/navigation";
import { requireAdmin, AccessError } from "@/lib/auth";
import { Studio } from "@/components/studio";
import { modelId, textModelIds, imageModelIds } from "@/lib/validation";
import type { Chain, Model, Run } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function Page() {
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    if (error instanceof AccessError)
      redirect(error.status === 403 ? "/login?error=access" : "/login");
    throw error;
  }
  const { supabase, user, profile } = session;
  const [chains, models, runs] = await Promise.all([
    supabase
      .from("prompt_chains")
      .select("*,prompt_chain_steps(*)")
      .order("updated_at", { ascending: false }),
    supabase
      .from("llm_models")
      .select("id,name,model_identifier,modality")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("prompt_chain_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (chains.error || models.error || runs.error)
    throw new Error(
      "Could not load workspace. Check database migrations and permissions.",
    );
  const supported = models.data.filter(
    (m) =>
      textModelIds.has(modelId(m.model_identifier)) ||
      imageModelIds.has(modelId(m.model_identifier)),
  );
  return (
    <Studio
      initialChains={chains.data as Chain[]}
      models={supported as Model[]}
      initialRuns={runs.data as Run[]}
      name={profile.first_name || user.email?.split("@")[0] || "Superadmin"}
      email={user.email || ""}
    />
  );
}
