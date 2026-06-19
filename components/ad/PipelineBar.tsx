"use client";
// Step pipeline: 대본 생성(LLM) → TTS 생성 → 렌더. Each step re-runnable; status
// derived from project state.
import { useState } from "react";
import type { AdProject } from "@/lib/ad/schema";

function StepChip({ n, label, done }: { n: number; label: string; done: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${done ? "text-eli5" : "text-muted"}`}>
      <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold text-white ${done ? "bg-eli5" : "bg-ink/30"}`}>
        {done ? "✓" : n}
      </span>
      {label}
    </span>
  );
}

export default function PipelineBar({
  project,
  busy,
  onCompose,
  onTtsAll,
  ttsProgress,
  onRenderFocus,
}: {
  project: AdProject;
  busy: boolean;
  onCompose: () => Promise<void>;
  onTtsAll?: () => Promise<void>;
  ttsProgress?: { done: number; total: number } | null;
  onRenderFocus?: () => void;
}) {
  const [composing, setComposing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasPages = project.pages.length > 0;
  const voPages = project.pages.filter((p) => p.vo.trim());
  const ttsDone = voPages.length > 0 && voPages.every((p) => p.voAudio);
  const rendered = !!project.latestRender;

  async function runCompose() {
    setConfirmOpen(false);
    setComposing(true);
    try {
      await onCompose();
    } finally {
      setComposing(false);
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <StepChip n={1} label="대본" done={hasPages} />
        <span className="text-muted">→</span>
        <StepChip n={2} label="TTS" done={ttsDone} />
        <span className="text-muted">→</span>
        <StepChip n={3} label="렌더" done={rendered} />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => (hasPages ? setConfirmOpen(true) : runCompose())}
          disabled={busy || composing}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-primary-dark active:scale-[0.98] disabled:opacity-40"
        >
          {composing ? "대본 생성 중…" : "대본 생성"}
        </button>
        {onTtsAll && (
          <button
            onClick={onTtsAll}
            disabled={busy || composing || voPages.length === 0}
            className="rounded-md border border-border bg-surface px-4 py-1.5 text-sm font-semibold text-ink transition-all duration-200 hover:border-empathy active:scale-[0.98] disabled:opacity-40"
          >
            {ttsProgress ? `TTS ${ttsProgress.done}/${ttsProgress.total}…` : "TTS 생성 (전체)"}
          </button>
        )}
        {onRenderFocus && (
          <button
            onClick={onRenderFocus}
            disabled={busy}
            className="rounded-md border border-border bg-surface px-4 py-1.5 text-sm font-semibold text-ink transition-all duration-200 hover:border-empathy active:scale-[0.98] disabled:opacity-40"
          >
            렌더 ↓
          </button>
        )}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={() => setConfirmOpen(false)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-ink">대본을 새로 생성할까요?</h3>
            <p className="mt-1.5 text-xs text-muted">
              현재 {project.pages.length}개 페이지가 <b>모두 교체</b>됩니다. (소스/VO도 초기화)
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmOpen(false)} className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:border-empathy">취소</button>
              <button onClick={runCompose} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark">교체 생성</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
