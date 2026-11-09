export type Model = {
  id: string;
  name: string;
  model_identifier: string;
  modality: string;
};
export type Step = {
  id: string;
  prompt_chain_id: string;
  position: number;
  name: string;
  llm_model_id: string;
  system_prompt: string;
  user_prompt: string;
  temperature: number | null;
  output_type: "text" | "image";
};
export type Chain = {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  prompt_chain_steps: Step[];
};
export type Output = {
  step_id: string;
  name: string;
  position: number;
  text: string;
  media: { path: string; media_type: string }[];
  model: string;
  duration_ms: number;
};
export type Run = {
  id: string;
  prompt_chain_id: string;
  created_at: string;
  completed_at: string | null;
  status: "running" | "completed" | "failed";
  input: string;
  input_image: string | null;
  error_message: string | null;
  outputs: Output[];
  chain_snapshot: { name: string; steps: Step[] };
};
export type Profile = {
  first_name: string | null;
  last_name: string | null;
  is_superadmin: boolean;
};
