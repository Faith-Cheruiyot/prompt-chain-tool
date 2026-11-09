import { z } from "zod";

export const stepSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, "Give each step a name.").max(120),
  llm_model_id: z.uuid("Select a model for every step."),
  system_prompt: z.string().max(12000).default(""),
  user_prompt: z
    .string()
    .trim()
    .min(1, "Add a prompt to every step.")
    .max(12000),
  temperature: z.number().min(0).max(2).nullable().default(null),
  output_type: z.enum(["text", "image"]),
});
export const chainSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1, "Give your chain a name.").max(120),
    description: z.string().trim().max(1000),
    is_active: z.boolean(),
    expected_updated_at: z.iso.datetime({ offset: true }).nullable(),
    steps: z.array(stepSchema).max(12, "A chain supports up to 12 steps."),
  })
  .refine(
    (v) => new Set(v.steps.map((s) => s.id)).size === v.steps.length,
    "Duplicate step IDs.",
  );

// References are positional and always follow the order visible in the editor.
export function resolvePrompt(
  template: string,
  input: string,
  previous: string,
  outputs: string[],
  position: number,
) {
  return template.replace(
    /\{\{\s*(input|previous|step\.(\d+))\s*\}\}/g,
    (_, key: string, index: string) => {
      if (key === "input") return input;
      if (key === "previous") return previous;
      const n = Number(index);
      if (n < 1 || n >= position)
        throw new Error(
          `Step ${position} references step ${n}, which has not run yet.`,
        );
      return outputs[n - 1] ?? "";
    },
  );
}

export function checkReferences(
  steps: { user_prompt: string; system_prompt: string }[],
) {
  steps.forEach((step, i) =>
    resolvePrompt(
      `${step.system_prompt}\n${step.user_prompt}`,
      "",
      "",
      [],
      i + 1,
    ),
  );
}

export const runSchema = z
  .object({
    input: z.string().trim().max(12000).default(""),
    image_path: z.string().max(300).nullable().default(null),
  })
  .refine(
    (v) => v.input.length > 0 || v.image_path,
    "Add text or an image to start the chain.",
  );

export function modelId(identifier: string) {
  return identifier.trim().replace(/^openai\//, "");
}
export const imageModelIds = new Set(["gpt-image-2.5-flare"]);
export const textModelIds = new Set(["gpt-5-nano"]);

export function defaultModel<T extends { model_identifier: string }>(
  models: T[],
  output: "text" | "image",
) {
  const supported = models.filter((m) =>
    (output === "image" ? imageModelIds : textModelIds).has(
      modelId(m.model_identifier),
    ),
  );
  return supported[0];
}
