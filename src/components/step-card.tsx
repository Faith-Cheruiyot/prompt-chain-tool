"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  GripVertical,
  Image,
  Trash2,
  Type,
} from "lucide-react";
import type { Step, Model } from "@/lib/types";
import {
  defaultModel,
  modelId,
  imageModelIds,
  textModelIds,
} from "@/lib/validation";
export function StepCard({
  step,
  index,
  total,
  models,
  expanded,
  onExpand,
  onChange,
  onMove,
  onDelete,
}: {
  step: Step;
  index: number;
  total: number;
  models: Model[];
  expanded: boolean;
  onExpand: () => void;
  onChange: (patch: Partial<Step>) => void;
  onMove: (to: number) => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });
  const available = models.filter((m) =>
    (step.output_type === "image" ? imageModelIds : textModelIds).has(
      modelId(m.model_identifier),
    ),
  );
  const model = models.find((m) => m.id === step.llm_model_id);
  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 3 : undefined,
      }}
      className={`step-card ${expanded ? "expanded" : ""} ${isDragging ? "dragging" : ""}`}
    >
      <div className="step-heading">
        <button
          type="button"
          className="drag-handle"
          {...attributes}
          {...listeners}
          aria-label={`Reorder step ${index + 1}: ${step.name}`}
        >
          <GripVertical size={18} />
        </button>
        <span className="step-number">
          {String(index + 1).padStart(2, "0")}
        </span>
        <button
          type="button"
          className="step-title"
          onClick={onExpand}
          aria-expanded={expanded}
        >
          <strong>{step.name || "Untitled step"}</strong>
          <span>
            {step.output_type === "image" ? (
              <Image size={12} />
            ) : (
              <Type size={12} />
            )}{" "}
            {model?.name || "Choose a model"}
          </span>
        </button>
        <div className="step-controls">
          <button
            type="button"
            className="icon-button"
            disabled={index === 0}
            title="Move step up"
            aria-label={`Move step ${index + 1} up`}
            onClick={() => onMove(index - 1)}
          >
            <ArrowUp size={15} />
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={index === total - 1}
            title="Move step down"
            aria-label={`Move step ${index + 1} down`}
            onClick={() => onMove(index + 1)}
          >
            <ArrowDown size={15} />
          </button>
          <button
            type="button"
            className="icon-button danger-hover"
            title="Delete step"
            aria-label={`Delete step ${index + 1}`}
            onClick={onDelete}
          >
            <Trash2 size={15} />
          </button>
          <button
            type="button"
            className={`icon-button chevron ${expanded ? "rotated" : ""}`}
            aria-label={expanded ? "Collapse step" : "Expand step"}
            onClick={onExpand}
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="step-body">
          <div className="field-row">
            <label>
              Step name
              <input
                value={step.name}
                maxLength={120}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="What does this step do?"
              />
            </label>
            <label className="output-field">
              Output
              <select
                value={step.output_type}
                onChange={(e) => {
                  const output_type = e.target.value as Step["output_type"];
                  const candidate = defaultModel(models, output_type);
                  onChange({ output_type, llm_model_id: candidate?.id || "" });
                }}
              >
                <option value="text">Text</option>
                <option value="image">Image</option>
              </select>
            </label>
          </div>
          <label>
            Model
            <select
              value={step.llm_model_id}
              onChange={(e) => onChange({ llm_model_id: e.target.value })}
            >
              <option value="" disabled>
                Select a model
              </option>
              {available.map((m) => (
                <option value={m.id} key={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">
              Prompt
              <span className="optional">The instruction for this step</span>
            </span>
            <textarea
              rows={5}
              maxLength={12000}
              value={step.user_prompt}
              onChange={(e) => onChange({ user_prompt: e.target.value })}
              placeholder="Tell the model what to create…"
              spellCheck={false}
            />
          </label>
          <div className="variable-bar">
            <span>Insert variable</span>
            {["{{input}}", ...(index > 0 ? ["{{previous}}"] : [])].map(
              (variable) => (
                <button
                  type="button"
                  key={variable}
                  onClick={() =>
                    onChange({
                      user_prompt: `${step.user_prompt}${step.user_prompt ? " " : ""}${variable}`,
                    })
                  }
                >
                  {variable}
                </button>
              ),
            )}
          </div>
          <details className="advanced">
            <summary>Advanced settings</summary>
            <label>
              System prompt <span className="optional">Optional</span>
              <textarea
                rows={3}
                maxLength={12000}
                value={step.system_prompt || ""}
                onChange={(e) => onChange({ system_prompt: e.target.value })}
                placeholder="Set a role, tone, or constraints."
              />
            </label>
          </details>
        </div>
      ) : (
        <button type="button" className="step-preview" onClick={onExpand}>
          {step.user_prompt || "Add a prompt to this step…"}
        </button>
      )}
    </article>
  );
}
