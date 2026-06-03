"use client";
// Render panel: choose output languages, render via SSE, show the full step checklist with
// per-step status (pending → active → done) + a progress bar, then preview + download.
import { useMemo, useState } from "react";
import type { Composition, RenderRecord } from "@/lib/composition-types";
import type { Language } from "@/lib/types";
import { LANGUAGE_LABELS } from "@/lib/channels";
import { streamRender, fileUrl, type RenderEvent } from "@/lib/client/wizard";

const ALL_LANGS: Language[] = ["ko", "ja", "en"];
const PHASE_LABEL: Record<string, string> = { start: "시작 카드", main: "본문 합성", end: "끝 카드", assemble: "조립" };

interface RStep {
  key: string; // `${lang}:${phase}`
  lang: Language;
  phase: string;
  label: string;
}

export default function RenderPanel({ comp, onBusy }: { comp: Composition; onBusy?: (b: boolean) => void }) {
  const [langs, setLangs] = useState<Language[]>(comp.renderLanguages?.length ? comp.renderLanguages : [comp.primaryLanguage]);
  const [rendering, setRendering] = useState(false);
  const [history, setHistory] = useState<RenderRecord[]>(
    comp.renderHistory ??
      Object.entries(comp.renders ?? {})
        .filter(([, p]) => p)
        .map(([language, p]) => ({ language: language as Language, path: p as string, createdAt: comp.updatedAt }))
  );
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<string | null>(null);

  const ready = Boolean(comp.stages.find((s) => s.id === "main")?.aRef && comp.stages.find((s) => s.id === "main")?.bRef);

  // The full ordered step plan for the selected languages (enabled stages + assemble per language).
  const steps: RStep[] = useMemo(() => {
    const stagePhases = comp.stages
      .filter((s) => s.enabled)
      .sort((a, b) => a.order - b.order)
      .map((s) => s.id as string);
    const phases = [...stagePhases, "assemble"];
    const out: RStep[] = [];
    for (const lang of langs) {
      for (const phase of phases) {
        out.push({ key: `${lang}:${phase}`, lang, phase, label: `${LANGUAGE_LABELS[lang]} · ${PHASE_LABEL[phase] ?? phase}` });
      }
    }
    return out;
  }, [comp.stages, langs]);

  const toggle = (l: Language) => !rendering && setLangs((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));

  function markActive(key: string) {
    const idx = steps.findIndex((s) => s.key === key);
    if (idx < 0) return;
    setActive(key);
    setDone(new Set(steps.slice(0, idx).map((s) => s.key))); // everything before is done (sequential)
  }

  async function render() {
    if (!langs.length || rendering) return;
    setRendering(true);
    onBusy?.(true);
    setErr(null);
    setDone(new Set());
    setActive(null);
    try {
      await streamRender(comp.compId, langs, (e: RenderEvent) => {
        if (e.type === "progress" && e.language && e.phase !== "done") markActive(`${e.language}:${e.phase}`);
        else if (e.type === "lang-done") {
          setHistory((h) => [{ language: e.language, path: e.path, createdAt: new Date().toISOString() }, ...h]);
          setDone((d) => new Set([...d, ...steps.filter((s) => s.lang === e.language).map((s) => s.key)]));
        } else if (e.type === "done") {
          setActive(null);
          setDone(new Set(steps.map((s) => s.key)));
        } else if (e.type === "error") setErr(e.message);
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRendering(false);
      onBusy?.(false);
    }
  }

  const total = steps.length;
  const pct = total ? Math.round((done.size / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <section className="rounded-lg border border-border bg-surface p-4">
        <h3 className="mb-3 text-sm font-bold">최종 영상 생성</h3>
        {!ready && <p className="mb-3 rounded-md bg-accent/30 p-2 text-sm text-ink">본론 비교 소스(A/B)를 먼저 설정하세요.</p>}
        <div className="mb-3">
          <div className="mb-1 text-xs text-muted">출력 언어</div>
          <div className="flex gap-2">
            {ALL_LANGS.map((l) => (
              <button
                key={l}
                disabled={rendering}
                onClick={() => toggle(l)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-all duration-200 disabled:opacity-40 ${langs.includes(l) ? "border-empathy bg-empathy/10 text-ink" : "border-border text-muted hover:border-empathy"}`}
              >
                {LANGUAGE_LABELS[l]}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={render}
          disabled={!ready || rendering || !langs.length}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-primary-dark active:scale-[0.98] disabled:opacity-40"
        >
          {rendering ? "렌더링 중…" : `최종 영상 생성 (${langs.length}개 언어)`}
        </button>
        {err && <p className="mt-2 text-sm text-danger">{err}</p>}

        {(rendering || done.size > 0) && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>진행 {done.size}/{total}</span>
              <span>{pct}%</span>
            </div>
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
            <ul className="flex flex-col gap-1">
              {steps.map((s) => {
                const st = done.has(s.key) ? "done" : active === s.key ? "active" : "pending";
                return (
                  <li key={s.key} className="flex items-center gap-2 text-sm">
                    <span
                      className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${
                        st === "done" ? "bg-eli5 text-white" : st === "active" ? "bg-warning text-white" : "bg-surface-muted text-muted"
                      }`}
                    >
                      {st === "done" ? "✓" : st === "active" ? <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> : "○"}
                    </span>
                    <span className={st === "pending" ? "text-muted" : st === "active" ? "font-medium text-ink" : "text-ink"}>
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h3 className="mb-3 text-sm font-bold">결과 <span className="text-xs font-normal text-muted">({history.length}개 · 최신순)</span></h3>
        <div className="flex flex-wrap gap-4">
          {history.map((r, i) => (
            <div key={`${r.path}-${i}`} className="flex flex-col gap-1">
              <div className="flex items-center gap-1 text-xs">
                <span className="rounded bg-empathy/10 px-1.5 py-0.5 font-medium text-ink">{LANGUAGE_LABELS[r.language]}</span>
                <span className="text-muted">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <video src={fileUrl(r.path)} controls className="h-[360px] w-[202px] rounded-md border border-border bg-ink" />
              <a href={fileUrl(r.path)} download className="text-center text-xs font-medium text-primary hover:underline">
                다운로드 ↓
              </a>
            </div>
          ))}
          {!history.length && <p className="text-sm text-muted">아직 렌더된 영상이 없습니다.</p>}
        </div>
      </section>
    </div>
  );
}
