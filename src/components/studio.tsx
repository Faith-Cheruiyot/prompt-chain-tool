"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clock3,
  GitBranch,
  Image,
  Layers3,
  LayoutGrid,
  Loader2,
  LogOut,
  Menu,
  MoreHorizontal,
  Play,
  Plus,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import type { Chain, Model, Output, Run, Step } from "@/lib/types";
import { defaultModel } from "@/lib/validation";
import { ThemeSwitch } from "./theme-switch";
import { Brand } from "./brand";
import { Dialog } from "./dialog";
import { StepCard } from "./step-card";
import { dateLabel, mediaUrl, OutputView, RunHistory } from "./run-history";

async function jsonRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "The request could not finish.");
  return data as T;
}
function sorted(chain: Chain): Chain {
  return {
    ...chain,
    prompt_chain_steps: [...chain.prompt_chain_steps].sort(
      (a, b) => a.position - b.position,
    ),
  };
}
function signature(chain: Chain | null) {
  return JSON.stringify(chain);
}

export function Studio({
  initialChains,
  models,
  initialRuns,
  name,
  email,
}: {
  initialChains: Chain[];
  models: Model[];
  initialRuns: Run[];
  name: string;
  email: string;
}) {
  const [chains, setChains] = useState(initialChains.map(sorted));
  const [runs, setRuns] = useState(initialRuns);
  const [view, setView] = useState<"chains" | "media">("chains");
  const [draft, setDraft] = useState<Chain | null>(null);
  const [baseline, setBaseline] = useState("null");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [mediaFilter, setMediaFilter] = useState("all");
  const [tab, setTab] = useState<"steps" | "history">("steps");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState<Run | null>(null);
  const [activePosition, setActivePosition] = useState(0);
  const [runInput, setRunInput] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [runnerTab, setRunnerTab] = useState<"input" | "output">("input");
  const [newOpen, setNewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [template, setTemplate] = useState("blank");
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [confirmation, setConfirmation] = useState<{
    title: string;
    body: string;
    label: string;
    action: () => void;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = draft !== null && signature(draft) !== baseline;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const message = useCallback((text: string, error = false) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice({ text, error });
    noticeTimer.current = setTimeout(
      () => setNotice(null),
      error ? 10000 : 4500,
    );
  }, []);
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const guarded = (action: () => void) => {
    if (running || saving) {
      message("Wait for the current operation to finish.");
      return;
    }
    if (dirty)
      setConfirmation({
        title: "Leave unsaved changes?",
        body: "Your changes haven’t been saved. Leave this chain and discard them?",
        label: "Discard changes",
        action,
      });
    else action();
  };
  function navigate(next: "chains" | "media") {
    guarded(() => {
      setView(next);
      setDraft(null);
      setBaseline("null");
      setMobileOpen(false);
    });
  }
  function selectChain(chain: Chain) {
    guarded(() => {
      const value = sorted(chain);
      setDraft(value);
      setBaseline(signature(value));
      setExpandedId(value.prompt_chain_steps[0]?.id || null);
      setView("chains");
      setTab("steps");
      setCurrentRun(null);
      setRunnerTab("input");
      setMobileOpen(false);
      setRunInput("");
      setImagePath(null);
    });
  }
  function newStep(chainId: string, position: number): Step {
    return {
      id: crypto.randomUUID(),
      prompt_chain_id: chainId,
      position,
      name: "Untitled step",
      llm_model_id: defaultModel(models, "text")?.id || "",
      system_prompt: "",
      user_prompt: "",
      temperature: null,
      output_type: "text",
    };
  }
  function openNew() {
    guarded(() => {
      setNewName("");
      setNewDescription("");
      setTemplate("blank");
      setNewOpen(true);
    });
  }
  function createChain(e: React.FormEvent) {
    e.preventDefault();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const steps =
      template === "captions"
        ? [
            {
              name: "Describe the image",
              user_prompt:
                "Describe the supplied image clearly and precisely. Include its subject, setting, and interesting visual details. {{input}}",
              system_prompt: "You are an observant visual storyteller.",
            },
            {
              name: "Find the funny",
              user_prompt:
                "Find one unexpected, funny observation about this description: {{previous}}",
              system_prompt: "You are a witty, playful comedy writer.",
            },
            {
              name: "Write five captions",
              user_prompt:
                "Turn this observation into five short, funny captions. Return a numbered list with one caption per line: {{previous}}",
              system_prompt:
                "Keep each caption under 15 words. Avoid hashtags.",
            },
          ].map((s, i) => ({ ...newStep(id, i + 1), ...s }))
        : [newStep(id, 1)];
    setDraft({
      id,
      name: newName.trim(),
      description: newDescription.trim(),
      is_active: template === "captions",
      created_at: now,
      updated_at: now,
      prompt_chain_steps: steps,
    });
    setBaseline("null");
    setExpandedId(steps[0].id);
    setNewOpen(false);
    setTab("steps");
    setView("chains");
    setCurrentRun(null);
    setRunnerTab("input");
    setRunInput("");
    setImagePath(null);
  }
  async function save() {
    if (!draft || saving || running) return;
    setSaving(true);
    try {
      const saved = sorted(
        await jsonRequest<Chain>("/api/chains", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: draft.id,
            name: draft.name,
            description: draft.description || "",
            is_active: draft.is_active,
            expected_updated_at:
              chains.find((c) => c.id === draft.id)?.updated_at || null,
            steps: draft.prompt_chain_steps,
          }),
        }),
      );
      setDraft(saved);
      setBaseline(signature(saved));
      setChains((old) => [saved, ...old.filter((c) => c.id !== saved.id)]);
      message("Chain saved. Your next idea is ready.");
    } catch (error) {
      message((error as Error).message, true);
    } finally {
      setSaving(false);
    }
  }
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  function removeChain(chain: Chain) {
    if (saving || running) return;
    setConfirmation({
      title: `Delete “${chain.name}”?`,
      body: "This deletes the chain, its steps, and its run history. This action cannot be undone.",
      label: "Delete chain",
      action: () => {
        void (async () => {
          try {
            if (chains.some((c) => c.id === chain.id))
              await jsonRequest(`/api/chains/${chain.id}`, {
                method: "DELETE",
              });
            setChains((old) => old.filter((c) => c.id !== chain.id));
            setRuns((old) => old.filter((r) => r.prompt_chain_id !== chain.id));
            setDraft(null);
            setBaseline("null");
            message("Chain deleted.");
          } catch (error) {
            message((error as Error).message, true);
          }
        })();
      },
    });
  }
  function changeStep(id: string, patch: Partial<Step>) {
    setDraft((old) =>
      old
        ? {
            ...old,
            prompt_chain_steps: old.prompt_chain_steps.map((s) =>
              s.id === id ? { ...s, ...patch } : s,
            ),
          }
        : old,
    );
  }
  function moveStep(from: number, to: number) {
    setDraft((old) =>
      old
        ? {
            ...old,
            prompt_chain_steps: arrayMove(old.prompt_chain_steps, from, to).map(
              (s, i) => ({ ...s, position: i + 1 }),
            ),
          }
        : old,
    );
  }
  function dragEnd(event: DragEndEvent) {
    if (!draft || !event.over || event.active.id === event.over.id) return;
    moveStep(
      draft.prompt_chain_steps.findIndex((s) => s.id === event.active.id),
      draft.prompt_chain_steps.findIndex((s) => s.id === event.over!.id),
    );
  }
  function addStep() {
    if (!draft || draft.prompt_chain_steps.length >= 12) return;
    const step = newStep(draft.id, draft.prompt_chain_steps.length + 1);
    setDraft({
      ...draft,
      prompt_chain_steps: [...draft.prompt_chain_steps, step],
    });
    setExpandedId(step.id);
  }
  function deleteStep(step: Step) {
    setConfirmation({
      title: "Remove this step?",
      body: `“${step.name}” will be removed when you save the chain. Check any numbered step references after reordering.`,
      label: "Remove step",
      action: () => {
        setDraft((old) =>
          old
            ? {
                ...old,
                prompt_chain_steps: old.prompt_chain_steps
                  .filter((s) => s.id !== step.id)
                  .map((s, i) => ({ ...s, position: i + 1 })),
              }
            : old,
        );
      },
    });
  }
  async function upload(file?: File) {
    if (!file || uploading || running) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { path } = await jsonRequest<{ path: string }>("/api/upload", {
        method: "POST",
        body: form,
      });
      setImagePath(path);
    } catch (error) {
      message((error as Error).message, true);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  async function refreshRuns() {
    setRefreshing(true);
    try {
      setRuns(await jsonRequest<Run[]>("/api/runs"));
    } catch (error) {
      message((error as Error).message, true);
    } finally {
      setRefreshing(false);
    }
  }
  async function runChain() {
    if (!draft || dirty || running || uploading) return;
    setRunning(true);
    setActivePosition(1);
    setCurrentRun(null);
    setRunnerTab("output");
    let runId = "";
    try {
      const res = await fetch(`/api/chains/${draft.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: runInput, image_path: imagePath }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Could not start this run.");
      }
      if (!res.body) throw new Error("No response received.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let terminal = false;
      function event(line: string) {
        if (!line.trim()) return;
        const data = JSON.parse(line);
        if (data.type === "run") {
          runId = data.run.id;
          setCurrentRun(data.run);
        }
        if (data.type === "step") setActivePosition(data.position);
        if (data.type === "output")
          setCurrentRun((old) =>
            old
              ? { ...old, outputs: [...old.outputs, data.output as Output] }
              : old,
          );
        if (data.type === "completed") {
          terminal = true;
          setCurrentRun((old) => (old ? { ...old, status: "completed" } : old));
          message("Chain complete. A fresh idea, ready to use.");
        }
        if (data.type === "error") {
          terminal = true;
          setCurrentRun((old) =>
            old ? { ...old, status: "failed", error_message: data.error } : old,
          );
          message(data.error, true);
        }
      }
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        lines.forEach(event);
      }
      buffer += decoder.decode();
      if (buffer.trim()) event(buffer);
      if (!terminal)
        throw new Error(
          "The connection was interrupted. Refresh run history to check saved outputs.",
        );
    } catch (error) {
      message((error as Error).message, true);
      setCurrentRun((old) =>
        old ? { ...old, error_message: (error as Error).message } : old,
      );
      if (!runId) setRunnerTab("input");
    } finally {
      setRunning(false);
      setActivePosition(0);
      await refreshRuns();
    }
  }
  const visibleChains = useMemo(
    () =>
      chains.filter(
        (c) =>
          `${c.name} ${c.description || ""}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (filter === "all" ||
            (filter === "ready" ? c.is_active : !c.is_active)),
      ),
    [chains, search, filter],
  );
  const chainRuns = runs.filter((r) => r.prompt_chain_id === draft?.id);
  const filteredRuns = runs.filter(
    (r) => mediaFilter === "all" || r.prompt_chain_id === mediaFilter,
  );
  const totalSteps = chains.reduce(
    (sum, c) => sum + c.prompt_chain_steps.length,
    0,
  );

  return (
    <div className="studio-shell">
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <Brand onClick={() => navigate("chains")} />
        <div className="workspace-label">
          <span className="workspace-avatar">H</span>
          <span>
            Humor workspace<small>Superadmin workspace</small>
          </span>
          <ShieldCheck size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          <button
            className={view === "chains" ? "active" : ""}
            onClick={() => navigate("chains")}
          >
            <Layers3 size={18} /> Prompt chains<span>{chains.length}</span>
          </button>
          <button
            className={view === "media" ? "active" : ""}
            onClick={() => navigate("media")}
          >
            <Image size={18} /> Generated media
          </button>
        </nav>
        <div className="nav-label recent-label">
          YOUR CHAINS
          <button aria-label="New prompt chain" onClick={openNew}>
            <Plus size={15} />
          </button>
        </div>
        <div className="sidebar-chains">
          {chains.slice(0, 8).map((chain) => (
            <button
              className={draft?.id === chain.id ? "selected" : ""}
              key={chain.id}
              onClick={() => selectChain(chain)}
            >
              <span className={`chain-dot ${chain.is_active ? "ready" : ""}`} />
              <span>{chain.name}</span>
            </button>
          ))}
          {!chains.length && <p>Your ideas will live here.</p>}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Sparkles size={17} />
            <strong>One step leads to another.</strong>
            <p>
              Build something worth
              <br />
              seeing through.
            </p>
            <button onClick={() => setHelpOpen(true)}>
              A quick guide <ArrowRight size={14} />
            </button>
          </div>
          <div className="sidebar-appearance">
            <span>Appearance</span>
            <ThemeSwitch />
          </div>
          <div className="account">
            <span className="account-avatar">
              {name.slice(0, 1).toUpperCase()}
            </span>
            <span title={email}>
              <strong>{name}</strong>
              <small>Superadmin</small>
            </span>
            <form action="/auth/logout" method="post">
              <button
                className="icon-button"
                aria-label="Sign out"
                title="Sign out"
                disabled={running || saving}
              >
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <button onClick={() => navigate(view)}>
              {view === "media" ? "Generated media" : "Prompt chains"}
            </button>
            {draft && (
              <>
                <ChevronRight size={13} />
                <strong>{draft.name}</strong>
              </>
            )}
          </div>
          <div className="topbar-right">
            <span className="admin-label">
              <ShieldCheck size={13} /> Superadmin access
            </span>
            <button
              className="icon-button"
              title="Quick guide"
              aria-label="Quick guide"
              onClick={() => setHelpOpen(true)}
            >
              <CircleHelp size={18} />
            </button>
          </div>
        </header>
        <main className={draft ? "editor-page" : "library-page"}>
          {!draft && view === "chains" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="section-kicker">
                    THE HUMOR PROJECT / PROMPT CHAINS
                  </div>
                  <h1>
                    Prompt chains<span className="title-dot">.</span>
                  </h1>
                  <p>A good idea is just the beginning. See where it goes.</p>
                </div>
                <button className="button primary" onClick={openNew}>
                  <Plus size={17} /> New chain
                </button>
              </div>
              <div className="stats-row">
                <div>
                  <span className="stat-icon">
                    <Layers3 size={18} />
                  </span>
                  <span>
                    <strong>{chains.length.toString().padStart(2, "0")}</strong>
                    <small>Prompt chains</small>
                  </span>
                </div>
                <div>
                  <span className="stat-icon">
                    <GitBranch size={18} />
                  </span>
                  <span>
                    <strong>{totalSteps.toString().padStart(2, "0")}</strong>
                    <small>Connected steps</small>
                  </span>
                </div>
                <div>
                  <span className="stat-icon">
                    <WandSparkles size={18} />
                  </span>
                  <span>
                    <strong>
                      {runs
                        .filter((r) => r.status === "completed")
                        .length.toString()
                        .padStart(2, "0")}
                    </strong>
                    <small>Recent completed runs</small>
                  </span>
                </div>
              </div>
              <div className="library-toolbar">
                <div
                  className="filter-tabs"
                  role="group"
                  aria-label="Filter chains"
                >
                  {["all", "ready", "draft"].map((value) => (
                    <button
                      key={value}
                      onClick={() => setFilter(value)}
                      className={filter === value ? "selected" : ""}
                    >
                      {value === "all"
                        ? "All chains"
                        : value === "ready"
                          ? "Ready to run"
                          : "Drafts"}
                      {value === "all" && <span>{chains.length}</span>}
                    </button>
                  ))}
                </div>
                <label className="search-field">
                  <Search size={16} />
                  <input
                    aria-label="Search chains"
                    placeholder="Search chains…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      aria-label="Clear search"
                      onClick={() => setSearch("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
              </div>
              {visibleChains.length ? (
                <div className="chain-grid">
                  {visibleChains.map((chain, i) => (
                    <article key={chain.id} className="chain-card">
                      <button
                        className="chain-card-body"
                        onClick={() => selectChain(chain)}
                      >
                        <div className="chain-card-top">
                          <span className={`chain-glyph color-${i % 3}`}>
                            <GitBranch size={23} />
                          </span>
                          <span
                            className={`badge ${chain.is_active ? "ready" : "draft"}`}
                          >
                            <span className="small-dot" />
                            {chain.is_active ? "Ready to run" : "Draft"}
                          </span>
                        </div>
                        <h2>{chain.name}</h2>
                        <p>
                          {chain.description ||
                            "A new sequence of possibilities. Open this chain to shape the next step."}
                        </p>
                        <div className="chain-visual" aria-hidden="true">
                          {chain.prompt_chain_steps
                            .slice(0, 5)
                            .map((step, index) => (
                              <span key={step.id}>
                                <span>
                                  {step.output_type === "image" ? (
                                    <Image size={13} />
                                  ) : (
                                    <span>
                                      {String(index + 1).padStart(2, "0")}
                                    </span>
                                  )}
                                </span>
                                {index <
                                  Math.min(chain.prompt_chain_steps.length, 5) -
                                    1 && <i />}
                              </span>
                            ))}
                          {!chain.prompt_chain_steps.length && (
                            <span className="muted">Add your first step</span>
                          )}
                        </div>
                      </button>
                      <div className="chain-card-footer">
                        <span>
                          {chain.prompt_chain_steps.length} steps
                          <span className="separator-dot">·</span>
                          {dateLabel(chain.updated_at)}
                        </span>
                        <div>
                          <button
                            className="icon-button danger-hover"
                            title="Delete chain"
                            aria-label={`Delete ${chain.name}`}
                            onClick={() => removeChain(chain)}
                          >
                            <Trash2 size={14} />
                          </button>
                          <button
                            className="icon-button"
                            title="Open chain"
                            aria-label={`Open ${chain.name}`}
                            onClick={() => selectChain(chain)}
                          >
                            <ArrowRight size={17} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                  <button className="new-chain-card" onClick={openNew}>
                    <span>
                      <Plus size={21} />
                    </span>
                    <strong>Make the next connection</strong>
                    <p>Start a fresh prompt chain</p>
                  </button>
                </div>
              ) : (
                <div className="library-empty">
                  <div className="empty-chain-illustration" aria-hidden="true">
                    <span>
                      <Image size={23} />
                    </span>
                    <i />
                    <span>
                      <Sparkles size={23} />
                    </span>
                    <i />
                    <span>
                      <WandSparkles size={23} />
                    </span>
                  </div>
                  <span className="section-kicker">
                    EVERY IDEA STARTS SOMEWHERE
                  </span>
                  <h2>
                    {chains.length
                      ? "No chains found."
                      : "One idea. A world of possibilities."}
                  </h2>
                  <p>
                    {chains.length
                      ? "Try a different search or filter to find your chain."
                      : "Connect a few prompts and let your creativity find its way.\nYour first chain is a good place to start."}
                  </p>
                  <button
                    className="button primary"
                    onClick={
                      chains.length
                        ? () => {
                            setSearch("");
                            setFilter("all");
                          }
                        : openNew
                    }
                  >
                    {chains.length ? (
                      "Clear filters"
                    ) : (
                      <>
                        <Plus size={17} /> Create your first chain
                      </>
                    )}
                  </button>
                  {!chains.length && (
                    <button
                      className="text-button"
                      onClick={() => {
                        setNewName("Image to funny captions");
                        setNewDescription(
                          "A fresh perspective on any image, in three creative steps.",
                        );
                        setTemplate("captions");
                        setNewOpen(true);
                      }}
                    >
                      Or try the image-to-captions template{" "}
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              )}
              <div className="page-footnote">
                <span className="small-dot" /> Great outputs start with
                thoughtful steps.
              </div>
            </>
          )}
          {!draft && view === "media" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="section-kicker">
                    FROM PROMPT TO POSSIBILITY
                  </span>
                  <h1>
                    Generated media<span className="title-dot">.</span>
                  </h1>
                  <p>
                    The ideas your chains brought to life. Text, images, and
                    every step between.
                  </p>
                </div>
                <button
                  className="button secondary"
                  onClick={refreshRuns}
                  disabled={refreshing}
                >
                  {refreshing ? (
                    <Loader2 size={16} className="spin" />
                  ) : (
                    <Clock3 size={16} />
                  )}{" "}
                  Refresh
                </button>
              </div>
              <div className="media-toolbar">
                <span>{filteredRuns.length} recent runs</span>
                <label>
                  Prompt chain
                  <select
                    value={mediaFilter}
                    onChange={(e) => setMediaFilter(e.target.value)}
                  >
                    <option value="all">All chains</option>
                    {chains.map((chain) => (
                      <option value={chain.id} key={chain.id}>
                        {chain.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <RunHistory runs={filteredRuns} onMessage={message} showChain />
            </>
          )}
          {draft && (
            <>
              <div className="editor-heading">
                <button
                  className="back-button"
                  onClick={() => navigate("chains")}
                >
                  <ArrowLeft size={15} /> All chains
                </button>
                <div className="editor-title-row">
                  <div>
                    <div className="editor-title">
                      <h1>{draft.name}</h1>
                      <span
                        className={`badge ${draft.is_active ? "ready" : "draft"}`}
                      >
                        <span className="small-dot" />
                        {draft.is_active ? "Ready" : "Draft"}
                      </span>
                    </div>
                    <p>
                      {draft.description ||
                        "Give your idea a direction, one prompt at a time."}
                    </p>
                  </div>
                  <div className="editor-actions">
                    <span className={`save-status ${dirty ? "unsaved" : ""}`}>
                      {dirty ? (
                        <>
                          <span className="small-dot" /> Unsaved changes
                        </>
                      ) : (
                        <>
                          <CheckCheck size={14} /> All changes saved
                        </>
                      )}
                    </span>
                    <button
                      className="icon-button"
                      aria-label="Chain settings"
                      title="Chain settings"
                      disabled={saving || running}
                      onClick={() => setSettingsOpen(true)}
                    >
                      <Settings2 size={18} />
                    </button>
                    <button
                      className="button primary"
                      disabled={!dirty || saving || running}
                      onClick={save}
                    >
                      {saving ? (
                        <Loader2 size={16} className="spin" />
                      ) : (
                        <Save size={16} />
                      )}{" "}
                      {saving ? "Saving…" : "Save chain"}
                    </button>
                  </div>
                </div>
              </div>
              <div
                className="editor-tabs"
                role="tablist"
                aria-label="Chain views"
              >
                <button
                  role="tab"
                  aria-selected={tab === "steps"}
                  className={tab === "steps" ? "selected" : ""}
                  onClick={() => setTab("steps")}
                >
                  <GitBranch size={16} /> Chain builder
                  <span>{draft.prompt_chain_steps.length}</span>
                </button>
                <button
                  role="tab"
                  aria-selected={tab === "history"}
                  className={tab === "history" ? "selected" : ""}
                  onClick={() => setTab("history")}
                >
                  <Clock3 size={16} /> Run history
                  <span>{chainRuns.length}</span>
                </button>
              </div>
              {tab === "history" ? (
                <div className="chain-history">
                  <div className="section-heading">
                    <div>
                      <h2>Every run tells a story.</h2>
                      <p>
                        Saved inputs and outputs, exactly as they were
                        generated.
                      </p>
                    </div>
                    <button
                      className="button secondary small"
                      onClick={refreshRuns}
                      disabled={refreshing}
                    >
                      {refreshing ? (
                        <Loader2 size={14} className="spin" />
                      ) : (
                        <Clock3 size={14} />
                      )}{" "}
                      Refresh
                    </button>
                  </div>
                  <RunHistory runs={chainRuns} onMessage={message} />
                </div>
              ) : (
                <div className="editor-columns">
                  <section
                    className="steps-panel"
                    aria-label="Prompt chain steps"
                  >
                    <div className="section-heading">
                      <div>
                        <span className="section-kicker">THE SEQUENCE</span>
                        <h2>Small steps. Better outputs.</h2>
                      </div>
                      <span className="step-count">
                        {draft.prompt_chain_steps.length} / 12 steps
                      </span>
                    </div>
                    <div className="sequence-start">
                      <span className="sequence-node">
                        <Upload size={14} />
                      </span>
                      <strong>Your input</strong>
                      <span>Text or an image</span>
                    </div>
                    <fieldset
                      className="steps-fieldset"
                      disabled={saving || running}
                    >
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={dragEnd}
                      >
                        <SortableContext
                          items={draft.prompt_chain_steps.map((s) => s.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="steps-list">
                            {draft.prompt_chain_steps.map((step, i) => (
                              <div className="step-wrapper" key={step.id}>
                                <div className="step-connector">
                                  <ArrowDown size={13} />
                                </div>
                                <StepCard
                                  step={step}
                                  index={i}
                                  total={draft.prompt_chain_steps.length}
                                  models={models}
                                  expanded={expandedId === step.id}
                                  onExpand={() =>
                                    setExpandedId(
                                      expandedId === step.id ? null : step.id,
                                    )
                                  }
                                  onChange={(patch) =>
                                    changeStep(step.id, patch)
                                  }
                                  onMove={(to) => moveStep(i, to)}
                                  onDelete={() => deleteStep(step)}
                                />
                              </div>
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                      <div className="add-step-area">
                        <div className="step-connector">
                          <ArrowDown size={13} />
                        </div>
                        <button
                          className="add-step-button"
                          onClick={addStep}
                          disabled={draft.prompt_chain_steps.length >= 12}
                        >
                          <Plus size={17} /> Add a step
                        </button>
                      </div>
                    </fieldset>
                    <div className="sequence-end">
                      <span className="sequence-node">
                        <Sparkles size={14} />
                      </span>
                      <strong>Your next possibility</strong>
                      <span>Every output becomes the next input</span>
                    </div>
                    <div className="builder-tip">
                      <CircleHelp size={16} />
                      <p>
                        Drag the handle to reorder, or use the arrow buttons.{" "}
                        <code>{"{{previous}}"}</code> follows the new order;{" "}
                        <code>{"{{step.1}}"}</code> references a numbered step.
                      </p>
                    </div>
                  </section>
                  <aside className="runner-panel">
                    <div className="runner-heading">
                      <span className="runner-icon">
                        <Play size={16} />
                      </span>
                      <div>
                        <h2>Give it a run</h2>
                        <p>A little input goes a long way.</p>
                      </div>
                    </div>
                    <div
                      className="runner-tabs"
                      role="group"
                      aria-label="Run panel"
                    >
                      <button
                        className={runnerTab === "input" ? "selected" : ""}
                        onClick={() => setRunnerTab("input")}
                      >
                        Input
                      </button>
                      <button
                        className={runnerTab === "output" ? "selected" : ""}
                        onClick={() => setRunnerTab("output")}
                      >
                        Output
                        {currentRun && <span>{currentRun.outputs.length}</span>}
                      </button>
                    </div>
                    {runnerTab === "input" ? (
                      <div className="runner-body">
                        <label className="runner-label">
                          Starting text
                          <span className="optional">
                            Optional with an image
                          </span>
                          <textarea
                            rows={4}
                            maxLength={12000}
                            value={runInput}
                            onChange={(e) => setRunInput(e.target.value)}
                            disabled={running}
                            placeholder="An idea, a little context, or something worth exploring…"
                          />
                        </label>
                        <span className="runner-label image-label">
                          Input image<span className="optional">Optional</span>
                        </span>
                        <input
                          ref={fileRef}
                          type="file"
                          hidden
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => void upload(e.target.files?.[0])}
                        />
                        {imagePath ? (
                          <div className="input-image-preview">
                            <img
                              src={mediaUrl(imagePath)}
                              alt="Selected input"
                            />
                            <button
                              className="icon-button"
                              disabled={running}
                              aria-label="Remove input image"
                              onClick={() => setImagePath(null)}
                            >
                              <X size={15} />
                            </button>
                          </div>
                        ) : (
                          <button
                            className="upload-zone"
                            disabled={uploading || running}
                            onClick={() => fileRef.current?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              void upload(e.dataTransfer.files[0]);
                            }}
                          >
                            {uploading ? (
                              <Loader2 size={25} className="spin" />
                            ) : (
                              <Upload size={25} />
                            )}
                            <strong>
                              {uploading
                                ? "Uploading your image…"
                                : "Drop an image here"}
                            </strong>
                            <span>
                              or <u>browse files</u>
                            </span>
                            <small>PNG, JPG, WebP · up to 3 MB</small>
                          </button>
                        )}
                        <div className="run-explainer">
                          <span>
                            <GitBranch size={15} />
                          </span>
                          <p>
                            Your input passes through{" "}
                            {draft.prompt_chain_steps.length}{" "}
                            {draft.prompt_chain_steps.length === 1
                              ? "step"
                              : "steps"}
                            . Each step builds on the one before it.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="runner-output">
                        {currentRun?.outputs.map((output) => (
                          <OutputView
                            key={output.step_id}
                            output={output}
                            onMessage={message}
                          />
                        ))}
                        {currentRun?.error_message && (
                          <div className="notice error" role="alert">
                            {currentRun.error_message}
                          </div>
                        )}
                        {running && (
                          <div className="running-message" role="status">
                            <Loader2 className="spin" size={19} />
                            <strong>
                              Step {activePosition} of{" "}
                              {draft.prompt_chain_steps.length}
                            </strong>
                            <span>Good things are taking shape…</span>
                          </div>
                        )}
                        {!currentRun && !running && (
                          <div className="runner-empty">
                            <Sparkles size={30} />
                            <h3>A space for the unexpected.</h3>
                            <p>
                              Add an input and run your chain.
                              <br />
                              Your outputs will appear here.
                            </p>
                          </div>
                        )}
                        {currentRun?.status === "completed" && (
                          <div className="completed-message">
                            <Check size={16} /> Chain complete. Saved to run
                            history.
                          </div>
                        )}
                      </div>
                    )}
                    <div className="runner-footer">
                      {dirty ? (
                        <p className="run-note">
                          Save your changes before running.
                        </p>
                      ) : !draft.is_active ? (
                        <p className="run-note">
                          Set this chain to ready in chain settings.
                        </p>
                      ) : !draft.prompt_chain_steps.length ? (
                        <p className="run-note">Add a step to get started.</p>
                      ) : null}
                      <button
                        className="button primary run-button"
                        onClick={runChain}
                        disabled={
                          dirty ||
                          running ||
                          saving ||
                          uploading ||
                          !draft.is_active ||
                          !draft.prompt_chain_steps.length ||
                          (!runInput.trim() && !imagePath)
                        }
                      >
                        {running ? (
                          <Loader2 size={17} className="spin" />
                        ) : (
                          <Play size={16} />
                        )}{" "}
                        {running ? "Running chain…" : "Run chain"}
                        {!running && <ArrowRight size={16} />}
                      </button>
                      <p className="run-credit">
                        <ShieldCheck size={12} /> Private outputs · Uses your
                        API account
                      </p>
                    </div>
                  </aside>
                </div>
              )}
            </>
          )}
        </main>
      </div>
      {notice && (
        <div
          className={`toast ${notice.error ? "error" : ""}`}
          role={notice.error ? "alert" : "status"}
        >
          {notice.error ? <CircleHelp size={17} /> : <Check size={17} />}
          <span>{notice.text}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {newOpen && (
        <Dialog title="A new connection." onClose={() => setNewOpen(false)}>
          <p className="dialog-description">
            Give your idea a name. We’ll take it one step at a time.
          </p>
          <form onSubmit={createChain}>
            <label>
              Chain name
              <input
                autoFocus
                required
                maxLength={120}
                placeholder="e.g. A fresh take on everyday moments"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <label>
              Description <span className="optional">Optional</span>
              <textarea
                rows={2}
                maxLength={1000}
                placeholder="What will this chain create?"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </label>
            <span className="field-label">Start with</span>
            <div className="template-options">
              <button
                type="button"
                className={template === "blank" ? "selected" : ""}
                onClick={() => setTemplate("blank")}
              >
                <Plus size={20} />
                <strong>A blank canvas</strong>
                <small>Your idea, your sequence</small>
              </button>
              <button
                type="button"
                className={template === "captions" ? "selected" : ""}
                onClick={() => setTemplate("captions")}
              >
                <Sparkles size={20} />
                <strong>Image to captions</strong>
                <small>Three steps to something funny</small>
              </button>
            </div>
            <div className="dialog-footer">
              <button
                type="button"
                className="button secondary"
                onClick={() => setNewOpen(false)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                disabled={!newName.trim()}
                type="submit"
              >
                Create chain <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {settingsOpen && draft && (
        <Dialog title="Chain settings" onClose={() => setSettingsOpen(false)}>
          <label>
            Chain name
            <input
              autoFocus
              required
              maxLength={120}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            Description
            <textarea
              rows={3}
              maxLength={1000}
              value={draft.description || ""}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          </label>
          <label>
            Status
            <select
              value={draft.is_active ? "ready" : "draft"}
              onChange={(e) =>
                setDraft({ ...draft, is_active: e.target.value === "ready" })
              }
            >
              <option value="draft">Draft — still taking shape</option>
              <option value="ready">Ready to run</option>
            </select>
          </label>
          <div className="settings-danger">
            <span>Delete this chain and its run history.</span>
            <button
              className="button danger small"
              onClick={() => {
                setSettingsOpen(false);
                removeChain(draft);
              }}
            >
              <Trash2 size={14} /> Delete chain
            </button>
          </div>
          <div className="dialog-footer">
            <span className="muted">
              Changes apply when you save the chain.
            </span>
            <button
              className="button primary"
              onClick={() => setSettingsOpen(false)}
            >
              Done <Check size={15} />
            </button>
          </div>
        </Dialog>
      )}
      {confirmation && (
        <Dialog
          title={confirmation.title}
          onClose={() => setConfirmation(null)}
        >
          <p className="dialog-description">{confirmation.body}</p>
          <div className="dialog-footer">
            <button
              className="button secondary"
              onClick={() => setConfirmation(null)}
            >
              Cancel
            </button>
            <button
              className="button danger"
              onClick={() => {
                const action = confirmation.action;
                setConfirmation(null);
                action();
              }}
            >
              {confirmation.label}
            </button>
          </div>
        </Dialog>
      )}
      {helpOpen && (
        <Dialog
          title="One idea. One step at a time."
          onClose={() => setHelpOpen(false)}
        >
          <div className="help-content">
            <p>
              A chain is a sequence of prompts. Each step gets the previous
              step’s output, along with your instructions.
            </p>
            <ol>
              <li>
                <strong>Create a chain.</strong> Start from scratch or try the
                three-step image-to-captions template.
              </li>
              <li>
                <strong>Shape your steps.</strong> Pick a text or image output,
                choose a model, and write the prompt.
              </li>
              <li>
                <strong>Connect the dots.</strong> Drag the handle or use the
                arrow buttons to change the order.
              </li>
              <li>
                <strong>Save and run.</strong> Set the chain to ready, add text
                or an image, then run it. Find the saved outputs in run history.
              </li>
            </ol>
            <div className="help-variables">
              <code>{"{{input}}"}</code>
              <span>The original starting text</span>
              <code>{"{{previous}}"}</code>
              <span>The previous step’s text output</span>
              <code>{"{{step.1}}"}</code>
              <span>Text from an earlier numbered step</span>
            </div>
            <p className="muted">
              Images pass to the next step automatically. Numbered references
              follow the displayed order. Use ⌘S / Ctrl+S to save.
            </p>
          </div>
          <div className="dialog-footer">
            <button
              className="button primary"
              onClick={() => setHelpOpen(false)}
            >
              Let’s make something <ArrowRight size={16} />
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
