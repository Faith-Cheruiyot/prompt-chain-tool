import { generateText } from "ai";
import { requireAdmin, apiError } from "@/lib/auth";
import { sameOrigin } from "@/lib/http";
import {
  modelId,
  modelProvider,
  imageModelIds,
  textModelIds,
  runSchema,
} from "@/lib/validation";
import { executeChain } from "@/lib/engine";
import { generationErrorMessage } from "@/lib/generation-error";
import { createGeminiProvider, GeminiConfigurationError } from "@/lib/gemini";
import {
  createOpenAIProvider,
  generateOpenAIStep,
  OpenAIConfigurationError,
} from "@/lib/openai";
import type { Step, Model, Output } from "@/lib/types";
import { z } from "zod";

export const maxDuration = 300;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    const { supabase, user } = await requireAdmin();
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      return Response.json({ error: "Invalid chain." }, { status: 400 });
    const parsed = runSchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    const [{ data: chain, error }, { data: allModels, error: modelError }] =
      await Promise.all([
        supabase
          .from("prompt_chains")
          .select("*,prompt_chain_steps(*)")
          .eq("id", id)
          .single(),
        supabase.from("llm_models").select("*").eq("is_active", true),
      ]);
    if (error || !chain)
      return Response.json({ error: "Chain not found." }, { status: 404 });
    if (modelError) throw modelError;
    const steps = (chain.prompt_chain_steps as Step[]).sort(
      (a, b) => a.position - b.position,
    );
    if (!chain.is_active || !steps.length)
      return Response.json(
        {
          error:
            "Add at least one step and set the chain to ready before running.",
        },
        { status: 400 },
      );
    const models = allModels as Model[];
    for (const step of steps) {
      const model = models.find((m) => m.id === step.llm_model_id);
      if (
        !model ||
        !(step.output_type === "image" ? imageModelIds : textModelIds).has(
          modelId(model.model_identifier),
        )
      )
        return Response.json(
          {
            error: `Choose a supported ${step.output_type} model for “${step.name}”.`,
          },
          { status: 400 },
        );
    }
    const neededProviders = new Set(
      steps.map((step) =>
        modelProvider(
          models.find((m) => m.id === step.llm_model_id)!.model_identifier,
        ),
      ),
    );
    const openai = neededProviders.has("openai")
      ? createOpenAIProvider()
      : null;
    const gemini = neededProviders.has("google")
      ? createGeminiProvider()
      : null;
    let image: Uint8Array | null = null;
    if (parsed.data.image_path) {
      if (
        !new RegExp(`^${user.id}/inputs/[\\da-f-]{36}\\.(png|jpg|webp)$`).test(
          parsed.data.image_path,
        )
      )
        return Response.json(
          { error: "Upload this image again." },
          { status: 400 },
        );
      const { data, error: imageError } = await supabase.storage
        .from("prompt-chain-media")
        .download(parsed.data.image_path);
      if (imageError || !data)
        return Response.json(
          { error: "Input image not found. Upload it again." },
          { status: 400 },
        );
      image = new Uint8Array(await data.arrayBuffer());
    }
    const { data: run, error: runError } = await supabase
      .from("prompt_chain_runs")
      .insert({
        prompt_chain_id: id,
        created_by: user.id,
        input: parsed.data.input,
        input_image: parsed.data.image_path,
        chain_snapshot: { name: chain.name, steps },
        status: "running",
      })
      .select()
      .single();
    if (runError) throw runError;
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: object) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          } catch {
            /* Persist results even when the viewer disconnects. */
          }
        };
        emit({ type: "run", run });
        const outputs: Output[] = [];
        let position = 1;
        const deadline = AbortSignal.timeout(240000);
        try {
          await executeChain({
            steps,
            input: parsed.data.input,
            image,
            modelName: (step) =>
              models.find((m) => m.id === step.llm_model_id)!.name,
            onStep: (n) => {
              position = n;
              emit({ type: "step", position: n });
            },
            async generate(step, prompt, system, inputImage) {
              const identifier = models.find(
                (m) => m.id === step.llm_model_id,
              )!.model_identifier;
              const abortSignal = AbortSignal.any([
                deadline,
                AbortSignal.timeout(90000),
              ]);
              if (modelProvider(identifier) === "openai")
                return generateOpenAIStep(openai!, {
                  identifier,
                  outputType: step.output_type,
                  prompt,
                  system,
                  inputImage,
                  temperature:
                    step.temperature === null ? null : Number(step.temperature),
                  abortSignal,
                });
              const result = await generateText({
                model: gemini!(modelId(identifier)),
                system: system || undefined,
                messages: [
                  {
                    role: "user",
                    content: inputImage
                      ? [
                          { type: "text", text: prompt },
                          { type: "image", image: inputImage },
                        ]
                      : [{ type: "text", text: prompt }],
                  },
                ],
                maxOutputTokens: step.output_type === "image" ? 8192 : 4096,
                ...(step.temperature === null
                  ? {}
                  : { temperature: Number(step.temperature) }),
                ...(step.output_type === "image"
                  ? {
                      providerOptions: {
                        google: { responseModalities: ["TEXT", "IMAGE"] },
                      },
                    }
                  : {}),
                abortSignal,
                maxRetries: 0,
              });
              return {
                text: result.text,
                images: result.files
                  .filter((f) =>
                    ["image/png", "image/jpeg", "image/webp"].includes(
                      f.mediaType,
                    ),
                  )
                  .map((f) => ({ data: f.uint8Array, mediaType: f.mediaType })),
              };
            },
            async saveImage(step, file, index) {
              const ext =
                file.mediaType === "image/jpeg"
                  ? "jpg"
                  : file.mediaType.split("/")[1];
              const path = `${user.id}/runs/${run.id}/${step.id}-${index}.${ext}`;
              const { error } = await supabase.storage
                .from("prompt-chain-media")
                .upload(path, file.data, { contentType: file.mediaType });
              if (error) throw error;
              return path;
            },
            async onOutput(output) {
              outputs.push(output);
              const { error } = await supabase
                .from("prompt_chain_runs")
                .update({ outputs })
                .eq("id", run.id);
              if (error) throw error;
              emit({ type: "output", output });
            },
          });
          const { error } = await supabase
            .from("prompt_chain_runs")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", run.id);
          if (error) throw error;
          emit({ type: "completed" });
        } catch (error) {
          const message = generationErrorMessage(
            error,
            position,
            deadline.aborted,
            modelProvider(
              models.find((m) => m.id === steps[position - 1].llm_model_id)!
                .model_identifier,
            ),
          );
          await supabase
            .from("prompt_chain_runs")
            .update({
              status: "failed",
              error_message: message,
              completed_at: new Date().toISOString(),
              outputs,
            })
            .eq("id", run.id);
          emit({ type: "error", error: message });
        } finally {
          try {
            controller.close();
          } catch {
            /* Client disconnected. */
          }
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "private, no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (
      error instanceof GeminiConfigurationError ||
      error instanceof OpenAIConfigurationError
    )
      return Response.json({ error: error.message }, { status: 503 });
    return apiError(error);
  }
}
