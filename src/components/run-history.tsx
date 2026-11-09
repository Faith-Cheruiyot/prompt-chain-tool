"use client";
import { useState } from "react";
import {
  ArrowDownToLine,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Image,
  Loader2,
  Play,
  TriangleAlert,
} from "lucide-react";
import type { Output, Run } from "@/lib/types";
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}
export function mediaUrl(path: string, download = false) {
  return `/api/media?path=${encodeURIComponent(path)}${download ? "&download=1" : ""}`;
}
export function OutputView({
  output,
  onMessage,
}: {
  output: Output;
  onMessage: (message: string) => void;
}) {
  return (
    <div className="output-block">
      <div className="output-heading">
        <span className="mini-step">
          {String(output.position).padStart(2, "0")}
        </span>
        <strong>{output.name}</strong>
        <span>{(output.duration_ms / 1000).toFixed(1)}s</span>
        {output.text && (
          <button
            className="icon-button"
            aria-label="Copy output"
            title="Copy output"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(output.text);
                onMessage("Output copied.");
              } catch {
                onMessage("Could not copy. Select the text to copy it.");
              }
            }}
          >
            <Copy size={14} />
          </button>
        )}
      </div>
      {output.text && <div className="output-text">{output.text}</div>}
      {output.media.map((file) => (
        <div className="output-image" key={file.path}>
          <a href={mediaUrl(file.path)} target="_blank" rel="noreferrer">
            <img
              src={mediaUrl(file.path)}
              alt={`Generated image from ${output.name}`}
              loading="lazy"
            />
          </a>
          <a
            href={mediaUrl(file.path, true)}
            className="button secondary small"
          >
            <ArrowDownToLine size={14} /> Download image
          </a>
        </div>
      ))}
    </div>
  );
}
export function RunHistory({
  runs,
  onMessage,
  showChain = false,
}: {
  runs: Run[];
  onMessage: (message: string) => void;
  showChain?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  function download(run: Run) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(run, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `chain-run-${run.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  if (!runs.length)
    return (
      <div className="empty-state">
        <span className="empty-icon">
          <Play size={25} />
        </span>
        <h3>A little input. A new possibility.</h3>
        <p>
          Run a chain to see its generated text and images here.
          <br />
          Every step’s output will be saved with the run.
        </p>
      </div>
    );
  return (
    <div className="run-history">
      {runs.map((run) => (
        <article className="run-card" key={run.id}>
          <button
            className="run-summary"
            onClick={() => setOpenId(openId === run.id ? null : run.id)}
            aria-expanded={openId === run.id}
          >
            <span className={`run-status ${run.status}`}>
              {run.status === "completed" ? (
                <Check size={17} />
              ) : run.status === "failed" ? (
                <TriangleAlert size={17} />
              ) : (
                <Loader2 size={17} className="spin" />
              )}
            </span>
            <span className="run-title">
              <strong>
                {showChain
                  ? run.chain_snapshot.name
                  : `Run ${run.id.slice(0, 8)}`}
              </strong>
              <span>{run.input || "Image input"}</span>
            </span>
            <span className="run-info">
              <span className={`badge ${run.status}`}>{run.status}</span>
              <span>{dateLabel(run.created_at)}</span>
            </span>
            <ChevronDown
              size={16}
              className={openId === run.id ? "rotated" : ""}
            />
          </button>
          {openId === run.id && (
            <div className="run-detail">
              <div className="run-detail-meta">
                <span>
                  <Clock3 size={14} /> {dateLabel(run.created_at)} ·{" "}
                  {run.outputs.length} outputs
                </span>
                <button className="text-button" onClick={() => download(run)}>
                  <ArrowDownToLine size={14} /> Export JSON
                </button>
              </div>
              {run.input_image && (
                <img
                  className="run-input-image"
                  src={mediaUrl(run.input_image)}
                  alt="Original run input"
                />
              )}
              {run.error_message && (
                <div className="notice error" role="alert">
                  {run.error_message}
                </div>
              )}
              {run.outputs.map((output) => (
                <OutputView
                  key={output.step_id}
                  output={output}
                  onMessage={onMessage}
                />
              ))}
              {run.status === "running" && (
                <p className="muted">
                  This run is processing. Refresh to check its latest status.
                </p>
              )}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
