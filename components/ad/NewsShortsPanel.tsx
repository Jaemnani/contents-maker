"use client";
// 뉴스 쇼츠 — aib.vote/news의 오늘 기사를 골라 쇼츠 컷을 자동 구성한다.
// 1건 선택 = 단일 집중형(5~6컷) · 2~5건 = 다이제스트(꼭지당 1컷).
// 모드: 브리핑(순수 뉴스) / AI 반응(질문 컷 + aib 투표 유도 — 엔드카드 강제).
// 구성 후 이미지 생성·TTS·렌더는 기존 에디터 흐름 그대로.
import { useState } from "react";
import type { AdProject } from "@/lib/ad/schema";
import { composeNewsShorts, fetchTodayNews, type NewsItem } from "@/lib/client/ad";

type Mode = "brief" | "ai_react";

export default function NewsShortsPanel({
  project,
  disabled,
  onApply,
  onFlush,
  onBusy,
}: {
  project: AdProject;
  disabled: boolean;
  onApply: (p: AdProject) => void;
  onFlush: () => Promise<void>;
  onBusy?: (b: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("brief");
  const [aibEndcard, setAibEndcard] = useState(true);
  const [done, setDone] = useState(false);

  const gated = disabled || busy;
  const chip = (on: boolean) =>
    `rounded-md border px-2.5 py-1 text-[12px] transition-all duration-200 ${on ? "border-empathy bg-empathy/10 text-ink" : "border-border text-muted hover:border-empathy"}`;
  const primaryBtn = "rounded-md bg-eli5 px-3 py-1.5 text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 disabled:opacity-40";

  async function loadNews() {
    if (gated) return;
    setBusy(true);
    onBusy?.(true);
    setErrMsg("");
    setPhase("aib.vote/news에서 오늘 기사 수집 중…");
    try {
      const r = await fetchTodayNews();
      setItems(r.items);
      setDate(r.date);
      setSelected([]);
      setDone(false);
    } catch (e) {
      setErrMsg((e as Error).message);
    } finally {
      setBusy(false);
      onBusy?.(false);
      setPhase("");
    }
  }

  function toggleItem(id: string) {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 5) return cur; // 다이제스트 최대 5꼭지
      return [...cur, id];
    });
  }

  async function compose() {
    if (gated || !items) return;
    const picked = selected.map((id) => items.find((i) => i.id === id)!).filter(Boolean);
    if (!picked.length) return setErrMsg("기사를 1개 이상 선택하세요.");
    if (project.pages.length > 0 && !confirm(`이 프로젝트의 기존 페이지가 ${picked.length === 1 ? "단일 집중형" : `${picked.length}꼭지 다이제스트`} 구성으로 교체됩니다. 진행할까요?`)) return;
    setBusy(true);
    onBusy?.(true);
    setErrMsg("");
    setWarnings([]);
    setPhase("대본 구성 중… (30초~1분)");
    try {
      await onFlush();
      const r = await composeNewsShorts(project.projectId, { mode, items: picked, aibEndcard });
      onApply(r.project);
      setWarnings(r.warnings);
      setDone(true);
    } catch (e) {
      setErrMsg((e as Error).message);
    } finally {
      setBusy(false);
      onBusy?.(false);
      setPhase("");
    }
  }

  const formLabel = selected.length <= 1 ? "단일 집중형" : `다이제스트 ${selected.length}꼭지`;
  return (
    <section className="mb-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-sm font-bold text-ink">
          <span className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}>▸</span>
          📰 뉴스 쇼츠
        </button>
        <span className="text-[11px] text-muted">aib.vote/news 오늘 기사 → 브리핑/AI반응 쇼츠 (1건=집중형 · 2~5건=다이제스트)</span>
        <div className="ml-auto flex items-center gap-2">
          {busy && <span className="text-[11px] text-muted">{phase || "처리 중…"}</span>}
        </div>
      </div>
      {errMsg && <p className="mt-2 text-xs text-warning">{errMsg}</p>}

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => void loadNews()} disabled={gated} className={items ? "rounded-md border border-border px-3 py-1.5 text-sm text-ink hover:border-empathy disabled:opacity-40" : primaryBtn}>
              {items ? "↻ 뉴스 다시 불러오기" : "📥 오늘 뉴스 불러오기"}
            </button>
            {items && <span className="text-xs text-muted">{date} · {items.length}건 — 만들 기사를 체크하세요</span>}
          </div>

          {items && (
            <>
              <div className="grid max-h-80 gap-1.5 overflow-y-auto pr-1 md:grid-cols-2">
                {items.map((n) => {
                  const on = selected.includes(n.id);
                  return (
                    <button
                      key={n.id}
                      onClick={() => toggleItem(n.id)}
                      disabled={gated || (!on && selected.length >= 5)}
                      className={`flex flex-col gap-0.5 rounded-md border p-2 text-left transition-all duration-200 ${on ? "border-empathy bg-empathy/10" : "border-border hover:border-empathy"} disabled:opacity-50`}
                    >
                      <span className="text-[13px] font-semibold leading-snug text-ink">
                        {on && <span className="mr-1 text-empathy">☑</span>}
                        {n.title}
                      </span>
                      {n.summary[0] && <span className="line-clamp-2 text-[11px] leading-snug text-muted">{n.summary[0]}</span>}
                      <span className="text-[10px] text-muted/80">{n.source} · {n.publishedAt}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-muted">모드:</span>
                <button onClick={() => setMode("brief")} className={chip(mode === "brief")} disabled={gated}>
                  뉴스 브리핑
                </button>
                <button onClick={() => setMode("ai_react")} className={chip(mode === "ai_react")} disabled={gated} title='마지막에 "AI들에게 물어본다면?" 질문 컷 + aib 투표 유도 (답변을 지어내지는 않음)'>
                  AI 반응 (질문+투표 유도)
                </button>
                <button
                  onClick={() => setAibEndcard((v) => !v)}
                  className={chip(aibEndcard || mode === "ai_react")}
                  disabled={gated || mode === "ai_react"}
                  title={mode === "ai_react" ? "AI 반응 모드는 엔드카드가 항상 켜집니다" : "aib.vote 로고+CTA 엔드카드"}
                >
                  {aibEndcard || mode === "ai_react" ? "☑" : "☐"} aib 엔드카드
                </button>
                <button onClick={() => void compose()} disabled={gated || !selected.length} className={`ml-auto ${primaryBtn}`}>
                  {busy ? phase || "구성 중…" : `🎬 ${formLabel}으로 쇼츠 구성`}
                </button>
              </div>
            </>
          )}

          {!!warnings.length && (
            <ul className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning">
              {warnings.map((w, i) => (
                <li key={i}>⚠️ {w}</li>
              ))}
            </ul>
          )}
          {done && (
            <p className="rounded-md bg-empathy/10 px-3 py-2 text-xs text-ink">
              ✅ 컷 구성 완료 — 아래 페이지 리스트에서 확인하고, 이미지 생성 → VO 생성 → 렌더를 진행하세요. 대본은 기사에 있는 사실만 쓰도록 지시했지만, 발행 전 수치·표현을 한 번 검토해 주세요.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
