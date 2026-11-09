import test from "node:test";
import assert from "node:assert/strict";
import { executeChain, type Generation } from "../src/lib/engine";
import {
  chainSchema,
  checkReferences,
  resolvePrompt,
} from "../src/lib/validation";
import type { Step, Output } from "../src/lib/types";

function step(
  position: number,
  prompt = "Continue {{previous}}",
  output_type: "text" | "image" = "text",
): Step {
  return {
    id: crypto.randomUUID(),
    prompt_chain_id: crypto.randomUUID(),
    position,
    name: `Step ${position}`,
    llm_model_id: crypto.randomUUID(),
    user_prompt: prompt,
    system_prompt: "",
    temperature: null,
    output_type,
  };
}
const textResult = (text: string): Generation => ({ text, images: [] });
test("substitutions retain literal user input and reference earlier numbered steps", () => {
  assert.equal(
    resolvePrompt(
      "{{input}} | {{ previous }} | {{step.1}}",
      "literal {{previous}}",
      "second",
      ["first", "second"],
      3,
    ),
    "literal {{previous}} | second | first",
  );
});
test("forward, self, and zero references are rejected before generation", () => {
  for (const ref of [0, 1, 2])
    assert.throws(
      () => checkReferences([step(1, `{{step.${ref}}}`)]),
      /has not run/,
    );
});
test("execution uses the saved order and automatically carries previous output", async () => {
  const calls: string[] = [];
  const saved: Output[] = [];
  await executeChain({
    steps: [step(2), step(1, "Describe")],
    input: "original",
    image: null,
    generate: async (s, prompt) => {
      calls.push(`${s.position}:${prompt}`);
      return textResult(`output ${s.position}`);
    },
    saveImage: async () => "unused",
    onOutput: async (output) => {
      saved.push(output);
    },
    modelName: () => "test model",
  });
  assert.match(calls[0], /^1:Describe/);
  assert.match(calls[0], /original/);
  assert.match(calls[1], /output 1/);
  assert.deepEqual(
    saved.map((s) => s.position),
    [1, 2],
  );
});
test("image input and a generated image are passed to later steps", async () => {
  const original = new Uint8Array([1]);
  const generated = new Uint8Array([2]);
  const seen: (Uint8Array | null)[] = [];
  const outputs: Output[] = [];
  await executeChain({
    steps: [step(1, "Draw", "image"), step(2)],
    input: "",
    image: original,
    generate: async (s, _p, _sys, image) => {
      seen.push(image);
      return s.position === 1
        ? { text: "", images: [{ data: generated, mediaType: "image/png" }] }
        : textResult("caption");
    },
    saveImage: async () => "private/image.png",
    onOutput: async (output) => {
      outputs.push(output);
    },
    modelName: () => "test",
  });
  assert.deepEqual(seen, [original, generated]);
  assert.equal(outputs[0].media[0].path, "private/image.png");
  assert.equal(outputs[1].text, "caption");
});
test("generation failure stops the chain while preserving earlier outputs", async () => {
  let calls = 0;
  const saved: Output[] = [];
  await assert.rejects(
    executeChain({
      steps: [step(1), step(2), step(3)],
      input: "seed",
      image: null,
      generate: async () => {
        if (++calls === 2) throw new Error("provider failed");
        return textResult("first");
      },
      saveImage: async () => "unused",
      onOutput: async (output) => {
        saved.push(output);
      },
      modelName: () => "test",
    }),
    /provider failed/,
  );
  assert.equal(calls, 2);
  assert.equal(saved.length, 1);
});
test("persistence failure prevents further generation", async () => {
  let calls = 0;
  await assert.rejects(
    executeChain({
      steps: [step(1), step(2)],
      input: "seed",
      image: null,
      generate: async () => {
        calls++;
        return textResult("text");
      },
      saveImage: async () => "unused",
      onOutput: async () => {
        throw new Error("database unavailable");
      },
      modelName: () => "test",
    }),
    /database unavailable/,
  );
  assert.equal(calls, 1);
});
test("image steps fail if the provider returns no image", async () => {
  await assert.rejects(
    executeChain({
      steps: [step(1, "Draw", "image")],
      input: "seed",
      image: null,
      generate: async () => textResult("cannot draw"),
      saveImage: async () => "unused",
      onOutput: async () => {},
      modelName: () => "test",
    }),
    /did not return an image/,
  );
});
test("validation rejects blank names, empty prompts, duplicate IDs, and oversized chains", () => {
  const s = step(1);
  const payload = {
    id: crypto.randomUUID(),
    name: "Test",
    description: "",
    is_active: true,
    expected_updated_at: null,
    steps: [s],
  };
  assert.equal(chainSchema.safeParse(payload).success, true);
  assert.equal(
    chainSchema.safeParse({ ...payload, name: "   " }).success,
    false,
  );
  assert.equal(
    chainSchema.safeParse({ ...payload, steps: [{ ...s, user_prompt: "" }] })
      .success,
    false,
  );
  assert.equal(
    chainSchema.safeParse({ ...payload, steps: [s, s] }).success,
    false,
  );
  assert.equal(
    chainSchema.safeParse({
      ...payload,
      steps: Array.from({ length: 13 }, (_, i) => step(i + 1)),
    }).success,
    false,
  );
});
