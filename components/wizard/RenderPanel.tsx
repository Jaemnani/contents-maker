"use client";
// Render panel: choose output languages + transition, render via Remotion (SSE), show
// per-language progress, then preview + download (render history, newest-first).
import { useState } from "react";
import type { Composition, RenderRecord, TransitionPreset } from "@/lib/composition-types";
import { TRANSITION_LABELS } from "@/lib/composition-types";
import type { Language } from "@/lib/types";
import { LANGUAGE_LABELS } from "@/lib/channels";
import { streamRender, fileUrl, type RenderEvent } from "@/lib/client/wizard";
import Select, { type SelectOption } from "@/components/ui/Select";

const ALL_LANGS: Language[] = ["ko", "ja", "en"];
const TRANSITION_OPTS: SelectOption[] = (Object.keys(TRANSITION_LABELS) as TransitionPreset[]).map((k) => ({ value: k, label: TRANSITION_LABELS[k] }));
const PHASE_LABEL: Record<string, string> = { start: "대기", browser: "브라우저 준비", bundle: "번들 준비", render: "렌더링", done: "완료" };

type Prog = Record<string, { pct: number; phase: string }>;

export default function RenderPanel({
  comp,
  onBusy,
  onPatchRenderOpts,
}: {
  comp: Composition;
  onBusy?: (b: boolean) => void;
  onPatchRenderOpts?: (patch: Partial<Composition["renderOpts"]>) => void;
}) {
  const [langs, setLangs] = useState<Language[]>(comp.renderLanguages?.length ? comp.renderLanguages : [comp.primaryLanguage]);
  const [rendering, setRendering] = useState(false);
  const [history, setHistory] = useState<RenderRecord[]>(
    comp.renderHistory ??
      Object.entries(comp.renders ?? {})
        .filter(([, p]) => p)
        .map(([language, p]) => ({ language: language as Language, path: p as string, createdAt: comp.updatedAt }))
  );
  const [err, setErr] = useState<string | null>(null);
  const [prog, setProg] = useState<Prog>({});

  const ready = Boolean(comp.stages.find((s) => s.id === "main")?.aRef && comp.stages.find((s) => s.id === "main")?.bRef);
  const toggle = (l: Language) => !rendering && setLangs((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));

  async function render() {
    if (!langs.length || rendering) return;
    setRendering(true);
    onBusy?.(true);
    setErr(null);
    setProg(Object.fromEntries(langs.map((l) => [l, { pct: 0, phase: "start" }])));
    try {
      await streamRender(comp.compId, langs, (e: RenderEvent) => {
        if (e.type === "progress" && e.language) setProg((p) => ({ ...p, [e.language!]: { pct: e.pct ?? p[e.language!]?.pct ?? 0, phase: e.phase } }));
        else if (e.type === "lang-done") {
          setHistory((h) => [{ language: e.language, path: e.path, createdAt: new Date().toISOString() }, ...h]);
          setProg((p) => ({ ...p, [e.language]: { pct: 100, phase: "done" } }));
        } else if (e.type === "error") setErr(e.message);
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRendering(false);
      onBusy?.(false);
    }
  }

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

        {onPatchRenderOpts && (
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs text-muted">전환 효과</label>
              <Select value={comp.renderOpts.transition || "default"} options={TRANSITION_OPTS} onChange={(v) => onPatchRenderOpts({ transition: v })} />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs text-muted">길이(초)</label>
              <input
                type="number"
                min={0.2}
                max={2}
                step={0.1}
                value={comp.renderOpts.transitionDurationSec ?? 0.4}
                onChange={(e) => onPatchRenderOpts({ transitionDurationSec: Number(e.target.value) || 0.4 })}
                className="w-full rounded-md border border-border bg-surface px-2 py-2 text-base outline-none focus:border-primary"
              />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs text-muted">타이밍</label>
              <Select
                value={comp.renderOpts.transitionTiming ?? "linear"}
                options={[{ value: "linear", label: "리니어" }, { value: "spring", label: "스프링" }]}
                onChange={(v) => onPatchRenderOpts({ transitionTiming: v as "linear" | "spring" })}
              />
            </div>
          </div>
        )}

        <button
          onClick={render}
          disabled={!ready || rendering || !langs.length}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-primary-dark active:scale-[0.98] disabled:opacity-40"
        >
          {rendering ? "렌더링 중…" : `최종 영상 생성 (${langs.length}개 언어)`}
        </button>
        {err && <p className="mt-2 text-sm text-danger">{err}</p>}

        {Object.keys(prog).length > 0 && (
          <ul className="mt-4 flex flex-col gap-3">
            {langs.map((l) => {
              const pr = prog[l];
              if (!pr) return null;
              return (
                <li key={l}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-ink">{LANGUAGE_LABELS[l]} · {PHASE_LABEL[pr.phase] ?? pr.phase}</span>
                    <span className="text-muted">{pr.pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pr.pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
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
