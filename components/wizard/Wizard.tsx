"use client";
// Wizard orchestrator: holds the Composition, free-navigation stepbar, per-stage save.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Composition, Stage, StageType } from "@/lib/composition-types";
import { STAGE_LABELS } from "@/lib/composition-types";
import { useModels } from "@/hooks/useModels";
import { saveComposition } from "@/lib/client/wizard";
import type { SelectOption } from "@/components/ui/Select";
import CardStage from "@/components/wizard/CardStage";
import MainStage from "@/components/wizard/MainStage";
import RenderPanel from "@/components/wizard/RenderPanel";

type Step = StageType | "render";
const STEPS: { id: Step; label: string }[] = [
  { id: "start", label: STAGE_LABELS.start },
  { id: "main", label: STAGE_LABELS.main },
  { id: "end", label: STAGE_LABELS.end },
  { id: "render", label: "렌더" },
];

export default function Wizard({ comp: initial, onExit }: { comp: Composition; onExit: () => void }) {
  const { data } = useModels();
  const [comp, setComp] = useState<Composition>(initial);
  const [step, setStep] = useState<Step>("start");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false); // long-running op (render) — locks navigation
  const idx = STEPS.findIndex((s) => s.id === step);
  const isFirst = idx === 0;
  const isLast = idx === STEPS.length - 1;

  const imageModels: SelectOption[] = useMemo(
    () => (data ? data.models.filter((m) => m.modality === "image").map((m) => ({ value: m.uid, label: m.label })) : []),
    [data]
  );

  // Warn before leaving the tab mid-render. (The server keeps rendering even if you leave,
  // and the result is saved to the project — but the live progress would be lost.)
  useEffect(() => {
    if (!busy) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [busy]);

  // Latest composition + a debounced save, so rapid edits (typing) don't fire a POST per
  // keystroke or race each other. compRef always holds the newest value to persist.
  const compRef = useRef(comp);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setBoth(next: Composition) {
    compRef.current = next;
    setComp(next);
  }

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      saveComposition(compRef.current).then(() => setSaving(false)).catch(() => setSaving(false));
    }, 400);
  }

  // Adopt a server-returned composition (already persisted) — no extra save.
  function applyComp(c: Composition) {
    setBoth(c);
  }

  function patchStage(stageId: StageType, patch: Partial<Stage>) {
    setBoth({ ...compRef.current, stages: compRef.current.stages.map((s) => (s.id === stageId ? { ...s, ...patch } : s)) });
    scheduleSave();
  }

  function patchRenderOpts(patch: Partial<Composition["renderOpts"]>) {
    setBoth({ ...compRef.current, renderOpts: { ...compRef.current.renderOpts, ...patch } });
    scheduleSave();
  }

  // Flush any pending save on unmount (e.g. navigating back to the list).
  useEffect(
    () => () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveComposition(compRef.current).catch(() => {});
      }
    },
    []
  );

  const stage = (id: StageType) => comp.stages.find((s) => s.id === id)!;

  return (
    <main className="mx-auto w-full max-w-[1280px] grow px-5 py-6">
      <header className="mb-5 flex items-center gap-3">
        <button onClick={onExit} disabled={busy} title={busy ? "렌더링 중에는 이동할 수 없습니다" : undefined} className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-muted transition-colors duration-200 hover:border-empathy hover:text-ink disabled:cursor-not-allowed disabled:opacity-40">← 목록</button>
        <h1 className="text-xl font-extrabold tracking-tight">숏폼 위자드</h1>
        <span className="text-xs text-muted">{comp.compId} · {comp.sourceType} · {comp.primaryLanguage}</span>
        {busy ? (
          <span className="ml-auto flex items-center gap-2 text-xs font-medium text-warning">
            <span className="h-2 w-2 animate-pulse rounded-full bg-warning" /> 렌더링 중 — 이동 잠금
          </span>
        ) : saving ? (
          <span className="ml-auto text-xs text-warning">저장 중…</span>
        ) : null}
      </header>

      <nav className="mb-6 flex gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            disabled={busy}
            onClick={() => setStep(s.id)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200 hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40 ${
              step === s.id ? "border-empathy bg-empathy/10 text-ink" : "border-border text-muted"
            }`}
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-xs text-white">{i + 1}</span>
            {s.label}
          </button>
        ))}
      </nav>

      {step === "start" && <CardStage comp={comp} stage={stage("start")} imageModels={imageModels} onPatch={(p) => patchStage("start", p)} onComp={applyComp} />}
      {step === "main" && <MainStage comp={comp} stage={stage("main")} imageModels={imageModels} onPatch={(p) => patchStage("main", p)} onComp={applyComp} />}
      {step === "end" && <CardStage comp={comp} stage={stage("end")} imageModels={imageModels} onPatch={(p) => patchStage("end", p)} onComp={applyComp} />}
      {step === "render" && <RenderPanel comp={comp} onBusy={setBusy} onPatchRenderOpts={patchRenderOpts} />}

      <div className="mt-6 flex justify-between">
        <button
          disabled={busy || isFirst}
          onClick={() => setStep(STEPS[Math.max(0, idx - 1)].id)}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm text-muted transition-colors duration-200 hover:border-empathy disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← 이전
        </button>
        {!isLast && (
          <button
            disabled={busy}
            onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, idx + 1)].id)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-primary-dark active:scale-[0.98] disabled:opacity-40"
          >
            다음 →
          </button>
        )}
      </div>
    </main>
  );
}
