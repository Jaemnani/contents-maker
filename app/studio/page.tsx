"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  GenResult, ImageParams, Language, Modality, SelectionMode, TextParams, VideoParams,
} from "@/lib/types";
import { useModels } from "@/hooks/useModels";
import { resolveModels, type TierPick } from "@/lib/selection";
import {
  estimateExact, estimateOne, estimateTier, type EstimateContext, type SelectionEstimate,
} from "@/lib/client/estimate";
import { runTextGeneration } from "@/lib/client/generate-text";
import { runImageGeneration } from "@/lib/client/generate-image";
import { sanitizePrompt } from "@/lib/client/sanitize";
import {
  runVideoGeneration, resumeVideoGeneration, readActiveJobs, clearActiveJobs, type ActiveJob,
} from "@/lib/client/generate-video";
import { VIDEO_DEFAULTS } from "@/lib/channels";
import { DEFAULT_TEXT_MAX_TOKENS } from "@/lib/tokens";
import LanguageTabs from "@/components/LanguageTabs";
import ContentTypeTabs from "@/components/ContentTypeTabs";
import ModelSelector from "@/components/ModelSelector";
import ChannelParams from "@/components/ChannelParams";
import CostEstimate from "@/components/CostEstimate";
import ResultsGrid from "@/components/ResultsGrid";

interface Selection {
  mode: SelectionMode;
  tierCounts: Record<string, number>;
  directIds: string[];
}
// Snapshot of the inputs used for a generation run, so retry/save use the SAME
// prompt/params even if the user edits the form afterward.
interface RunCtx {
  prompt: string;
  language: Language;
  contentType: Modality;
  textParams: TextParams;
  imageParams: ImageParams;
  videoParams: VideoParams;
}
// Per-modality selection so switching tabs keeps each type's own picks/counts.
const DEFAULT_SELECTIONS: Record<Modality, Selection> = {
  text: { mode: "tier", tierCounts: { standard: 3 }, directIds: [] },
  image: { mode: "tier", tierCounts: { budget: 2 }, directIds: [] },
  video: { mode: "tier", tierCounts: { budget: 2 }, directIds: [] },
};

const tierCountsToPicks = (tc: Record<string, number>): TierPick[] =>
  Object.entries(tc)
    .filter(([, c]) => c > 0)
    .map(([tier, count]) => ({ tier: tier as TierPick["tier"], count }));

export default function Home() {
  const { data, error } = useModels();

  const [language, setLanguage] = useState<Language>("ko");
  const [contentType, setContentType] = useState<Modality>("text");
  const [prompt, setPrompt] = useState("");
  const [selections, setSelections] = useState<Record<Modality, Selection>>(DEFAULT_SELECTIONS);
  // Default: send the prompt verbatim (원본) for all modalities.
  const [textParams, setTextParams] = useState<TextParams>({ maxTokens: DEFAULT_TEXT_MAX_TOKENS, mode: "raw" });
  const [imageParams, setImageParams] = useState<ImageParams>({ aspects: ["9:16"], resolution: "1k", enhance: false });
  const [videoParams, setVideoParams] = useState<VideoParams>({
    resolution: VIDEO_DEFAULTS.resolution,
    aspectRatio: VIDEO_DEFAULTS.aspectRatio,
    duration: VIDEO_DEFAULTS.duration,
    enhance: false,
  });
  const [results, setResults] = useState<GenResult[]>([]);
  const [running, setRunning] = useState(false);
  const [sanitize, setSanitize] = useState(false);
  const [sanitizing, setSanitizing] = useState(false);
  const [sanitizedNote, setSanitizedNote] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [recoverable, setRecoverable] = useState<ActiveJob[]>([]);
  const resultsRef = useRef<Record<string, GenResult>>({});
  const runCtxRef = useRef<RunCtx | null>(null);

  const sel = selections[contentType];
  const setSel = (patch: Partial<Selection>) =>
    setSelections((prev) => ({ ...prev, [contentType]: { ...prev[contentType], ...patch } }));

  // On load, detect video jobs left in-progress from a previous session (concern #6).
  useEffect(() => {
    const jobs = readActiveJobs();
    // defer out of the effect's synchronous phase (avoids cascading-render lint + build block)
    if (jobs.length) queueMicrotask(() => setRecoverable(jobs));
  }, []);

  const update = (model: string, patch: Partial<GenResult>) => {
    const cur = resultsRef.current[model] ?? { model, status: "idle" as const };
    resultsRef.current[model] = { ...cur, ...patch };
    setResults(Object.values(resultsRef.current));
  };

  async function resumeJobs() {
    const jobs = recoverable;
    if (!jobs.length) return;
    setRecoverable([]);
    setContentType("video");
    const first = jobs[0];
    const c: RunCtx = {
      prompt: first.prompt,
      language: first.language,
      contentType: "video",
      textParams,
      imageParams,
      videoParams: first.params,
    };
    runCtxRef.current = c;
    const init: GenResult[] = jobs.map((j) => ({ model: j.model, status: "processing", jobId: j.jobId }));
    resultsRef.current = Object.fromEntries(init.map((r) => [r.model, r]));
    setResults(init);
    setRunning(true);
    await resumeVideoGeneration({ jobs, onUpdate: update });
    setRunning(false);
    const finalResults = Object.values(resultsRef.current);
    if (finalResults.some((r) => r.status === "done")) await save(finalResults, c);
  }

  const modelsForType = useMemo(
    () => (data ? data.models.filter((m) => m.modality === contentType) : []),
    [data, contentType]
  );
  const presetIds = data?.cheapestPresets[contentType] ?? [];

  const ctx: EstimateContext = {
    prompt,
    language,
    maxTokens: textParams.maxTokens,
    aspectCount: imageParams.aspects.length || 1,
    videoParams,
  };

  const est: SelectionEstimate = useMemo(() => {
    if (!data) return { min: 0, max: 0, exact: true, unknownCount: 0 };
    if (sel.mode === "direct") return estimateExact(sel.directIds, contentType, data.byId, ctx);
    if (sel.mode === "preset") return estimateExact(presetIds, contentType, data.byId, ctx);
    return estimateTier(
      tierCountsToPicks(sel.tierCounts),
      contentType,
      (t) => modelsForType.filter((m) => m.tier === t),
      ctx
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, sel, presetIds, contentType, prompt, language, textParams, imageParams, videoParams]);

  const resolvedCount =
    sel.mode === "tier"
      ? Object.values(sel.tierCounts).reduce((s, c) => s + (c || 0), 0)
      : sel.mode === "direct"
        ? sel.directIds.length
        : presetIds.length;

  function switchType(t: Modality) {
    if (running) return;
    setContentType(t);
    setResults([]);
    setSavedPath(null);
  }

  function computeCost(model: string, usage: { prompt_tokens?: number; completion_tokens?: number }) {
    const m = data?.byId[model];
    const p = m?.pricing?.prompt;
    const c = m?.pricing?.completion;
    if (p == null || c == null) return null;
    return (usage.prompt_tokens ?? 0) * p + (usage.completion_tokens ?? 0) * c;
  }

  async function save(finalResults: GenResult[], c: RunCtx) {
    const params = c.contentType === "text" ? c.textParams : c.contentType === "image" ? c.imageParams : c.videoParams;
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: c.contentType,
          language: c.language,
          prompt: c.prompt,
          params,
          results: finalResults,
        }),
      });
      const d = await res.json();
      if (d.savedTo) setSavedPath(d.savedTo);
    } catch {
      /* save failure is non-fatal */
    }
  }

  async function onGenerate() {
    if (!data) return;
    const ids = [
      ...new Set(
        resolveModels(contentType, {
          mode: sel.mode,
          tierPicks: tierCountsToPicks(sel.tierCounts),
          directIds: sel.directIds,
        })
      ),
    ];
    if (!prompt.trim() || !ids.length) return;

    setRunning(true);
    setSavedPath(null);
    setSanitizedNote(null);

    // Optionally rewrite the prompt to pass content filters (image/video only).
    let finalPrompt = prompt;
    if (sanitize && contentType !== "text") {
      setSanitizing(true);
      finalPrompt = await sanitizePrompt(prompt, language);
      setSanitizing(false);
      if (finalPrompt !== prompt) setSanitizedNote(finalPrompt);
    }

    // Snapshot inputs for this run (used by retry + save).
    const c: RunCtx = { prompt: finalPrompt, language, contentType, textParams, imageParams, videoParams };
    runCtxRef.current = c;

    const init: GenResult[] = ids.map((m) => ({ model: m, status: "loading" }));
    resultsRef.current = Object.fromEntries(init.map((r) => [r.model, r]));
    setResults(init);

    if (c.contentType === "text") {
      await runTextGeneration({
        models: ids,
        prompt: c.prompt,
        language: c.language,
        maxTokens: c.textParams.maxTokens,
        mode: c.textParams.mode,
        onUpdate: update,
        computeCost,
      });
    } else if (c.contentType === "image") {
      await runImageGeneration({
        models: ids,
        aspects: c.imageParams.aspects.length ? c.imageParams.aspects : ["1:1"],
        prompt: c.prompt,
        language: c.language,
        enhance: c.imageParams.enhance,
        resolution: c.imageParams.resolution,
        onUpdate: update,
      });
    } else {
      await runVideoGeneration({
        models: ids,
        prompt: c.prompt,
        language: c.language,
        params: c.videoParams,
        onUpdate: update,
      });
    }

    setRunning(false);
    const finalResults = Object.values(resultsRef.current);
    if (finalResults.some((r) => r.status === "done")) await save(finalResults, c);
  }

  // Retry a single failed model with the SAME inputs as the original run (snapshot).
  async function retryModel(model: string) {
    const c = runCtxRef.current;
    if (!data || running || !data.byId[model] || !c) return;
    setRunning(true);
    update(model, {
      status: "loading",
      error: undefined,
      raw: undefined,
      variants: undefined,
      images: undefined,
      videoUrl: undefined,
      jobId: undefined,
      ms: undefined,
      actualCost: undefined,
    });

    if (c.contentType === "text") {
      await runTextGeneration({
        models: [model], prompt: c.prompt, language: c.language,
        maxTokens: c.textParams.maxTokens, mode: c.textParams.mode,
        onUpdate: update, computeCost,
      });
    } else if (c.contentType === "image") {
      await runImageGeneration({
        models: [model],
        aspects: c.imageParams.aspects.length ? c.imageParams.aspects : ["1:1"],
        prompt: c.prompt, language: c.language, enhance: c.imageParams.enhance, resolution: c.imageParams.resolution, onUpdate: update,
      });
    } else {
      await runVideoGeneration({ models: [model], prompt: c.prompt, language: c.language, params: c.videoParams, onUpdate: update });
    }

    setRunning(false);
    const finalResults = Object.values(resultsRef.current);
    if (finalResults.some((r) => r.status === "done")) await save(finalResults, c);
  }

  return (
    <main className="mx-auto w-full max-w-[1280px] grow px-5 py-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Source <span className="text-primary">Studio</span>
          </h1>
          <p className="text-sm text-muted">같은 프롬프트 × 여러 AI로 소스를 미리 생성 — 위자드에서 불러와 사용</p>
        </div>
        <Link
          href="/"
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted transition-colors duration-200 hover:border-empathy hover:text-ink"
        >
          ← 숏폼 위자드
        </Link>
      </header>

      {error && (
        <div className="mb-4 rounded-md bg-danger/10 p-3 text-sm text-danger">
          모델 목록을 불러오지 못했습니다: {error}
        </div>
      )}

      {recoverable.length > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-md bg-accent/30 p-3 text-sm text-ink">
          <span>진행 중이던 영상 {recoverable.length}건이 있습니다 — 이어서 결과를 받아올 수 있어요.</span>
          <span className="flex gap-2">
            <button onClick={resumeJobs} className="rounded-md bg-warning px-3 py-1 font-medium text-white">
              이어보기
            </button>
            <button
              onClick={() => { clearActiveJobs(); setRecoverable([]); }}
              className="rounded-md px-3 py-1 text-muted hover:bg-surface-muted"
            >
              지우기
            </button>
          </span>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <LanguageTabs value={language} disabled={running} onChange={(l) => { setLanguage(l); setResults([]); }} />
        <ContentTypeTabs value={contentType} disabled={running} onChange={switchType} />
        {running && <span className="text-xs text-warning">생성 중 — 탭 전환 잠금</span>}
        {data && (
          <span className="text-xs text-muted">
            단가: {data.pricingSource === "live" ? "라이브" : "정적"} · {data.generatedAt}
          </span>
        )}
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={language === "ko" ? "프롬프트를 입력하세요…" : "プロンプトを入力…"}
        className="mb-2 h-24 w-full resize-y rounded-md border border-border bg-surface p-3 text-sm outline-none transition-colors duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
      />

      {(contentType === "image" || contentType === "video") && (
        <label className="mb-2 flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={sanitize} onChange={(e) => setSanitize(e.target.checked)} className="accent-primary" />
          🛡 프롬프트 자동 순화 (LLM — 아동·민감 표현을 정책 안전하게 리라이트, 호출 1회 추가)
        </label>
      )}

      {sanitizedNote && (
        <div className="mb-2 rounded-md bg-primary/10 p-2 text-xs text-primary">
          순화된 프롬프트로 생성됨 → {sanitizedNote}
        </div>
      )}
      <div className="mb-4" />

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-bold">모델 선택</h2>
          {data ? (
            <ModelSelector
              modality={contentType}
              models={modelsForType}
              tiers={data.tiers}
              tierLabels={data.tierLabels}
              presetIds={presetIds}
              mode={sel.mode}
              onMode={(m) => setSel({ mode: m })}
              tierCounts={sel.tierCounts}
              onTierCounts={(tc) => setSel({ tierCounts: tc })}
              directIds={sel.directIds}
              onDirect={(ids) => setSel({ directIds: ids })}
              estOne={(m) => estimateOne(m, contentType, ctx)}
              language={language}
            />
          ) : (
            <p className="text-sm text-muted">모델 불러오는 중…</p>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <div>
            <h2 className="mb-2 text-sm font-bold">파라미터</h2>
            <ChannelParams
              modality={contentType}
              text={textParams}
              onText={setTextParams}
              image={imageParams}
              onImage={setImageParams}
              video={videoParams}
              onVideo={setVideoParams}
            />
          </div>
          <CostEstimate est={est} modelCount={resolvedCount} />
          <button
            onClick={onGenerate}
            disabled={running || !prompt.trim() || resolvedCount === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-primary-dark active:scale-[0.98] disabled:opacity-40"
          >
            {sanitizing ? "프롬프트 순화 중…" : running ? "생성 중…" : `생성 (${resolvedCount}개 모델)`}
          </button>
        </section>
      </div>

      {savedPath && (
        <div className="mb-4 rounded-md bg-eli5-light p-2 text-sm text-eli5-dark">
          저장됨 → <code>{savedPath}</code>
        </div>
      )}

      {data && (
        <ResultsGrid
          results={results}
          contentType={contentType}
          modelsById={data.byId}
          onRetry={retryModel}
          busy={running}
        />
      )}
    </main>
  );
}
