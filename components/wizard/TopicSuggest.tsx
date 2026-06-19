"use client";
// Topic suggestion panel: trend provider + keyword + region(auto from language)
// -> trend list (rising/breakout badges) -> LLM curation -> pick a candidate.
import { useCallback, useEffect, useState } from "react";
import type { Language } from "@/lib/types";
import type { TrendItem, TrendKind } from "@/lib/trends/types";
import { langToRegion } from "@/lib/trends/types";
import {
  listTrendProviders,
  fetchTrends,
  curateTopics,
  type TrendProviderInfo,
  type TopicCandidate,
} from "@/lib/client/wizard";

const KIND_LABEL: Record<TrendKind, string> = {
  rising: "급상승",
  breakout: "폭발",
  top: "인기",
  news: "뉴스",
  video: "영상",
};
const KIND_CLASS: Record<TrendKind, string> = {
  breakout: "bg-danger/15 text-danger",
  rising: "bg-empathy/15 text-empathy",
  top: "bg-primary/15 text-primary",
  news: "bg-ink/10 text-muted",
  video: "bg-ink/10 text-muted",
};

const loc = (t: { ko?: string; ja?: string; en?: string }, lang: Language) =>
  t[lang] ?? t.ko ?? t.en ?? t.ja ?? "";

export default function TopicSuggest({
  language,
  chosen,
  onPick,
}: {
  language: Language;
  chosen: TopicCandidate | null;
  onPick: (c: TopicCandidate | null) => void;
}) {
  const [providers, setProviders] = useState<TrendProviderInfo[]>([]);
  const [provider, setProvider] = useState<string>(""); // "" = keyword-only
  const [keyword, setKeyword] = useState("");
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [candidates, setCandidates] = useState<TopicCandidate[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [loadingTopic, setLoadingTopic] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    listTrendProviders(language).then(setProviders).catch(() => setProviders([]));
  }, [language]);

  const loadTrends = useCallback(async () => {
    if (!provider) return;
    setLoadingTrends(true);
    setErr("");
    try {
      const { items, error } = await fetchTrends(provider, language, keyword.trim() || undefined);
      setTrends(items);
      setSelected(new Set(items.map((i) => i.term)));
      if (error) setErr(error);
      else if (!items.length) setErr("트렌드 결과가 없습니다. 키워드를 바꿔보세요.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoadingTrends(false);
    }
  }, [provider, language, keyword]);

  const toggle = (term: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(term)) n.delete(term);
      else n.add(term);
      return n;
    });

  const suggest = useCallback(async () => {
    const terms = provider && trends.length ? [...selected] : keyword.trim() ? [keyword.trim()] : [];
    if (!terms.length) {
      setErr(provider ? "추천에 사용할 트렌드를 1개 이상 선택하세요." : "키워드를 입력하세요.");
      return;
    }
    setLoadingTopic(true);
    setErr("");
    onPick(null); // drop any prior pick — it belonged to the list we're about to replace
    try {
      const c = await curateTopics({ terms, language, max: 6 });
      setCandidates(c);
      if (!c.length) setErr("주제 후보를 만들지 못했습니다. 다시 시도하세요.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoadingTopic(false);
    }
  }, [provider, trends.length, selected, keyword, language, onPick]);

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface-muted/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-ink">✨ 비교 프롬프트 추천 <span className="text-xs font-normal text-muted">(본론)</span></span>
        <span className="text-xs text-muted">트렌드 → AI가 본론 비교 프롬프트로 가공 · 지역 {langToRegion[language]}</span>
      </div>

      {/* provider chips */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setProvider(""); setTrends([]); setSelected(new Set()); }}
          className={`rounded-md border px-3 py-1.5 text-xs transition-all duration-200 ${provider === "" ? "border-empathy bg-empathy/10 text-ink" : "border-border text-muted hover:border-empathy"}`}
        >
          키워드만
        </button>
        {providers.map((p) => (
          <button
            key={p.id}
            onClick={() => { setProvider(p.id); setTrends([]); setSelected(new Set()); }}
            className={`rounded-md border px-3 py-1.5 text-xs transition-all duration-200 ${provider === p.id ? "border-empathy bg-empathy/10 text-ink" : "border-border text-muted hover:border-empathy"}`}
          >
            {p.label}
          </button>
        ))}
        {providers.length === 0 && (
          <span className="text-xs text-muted">설정된 트렌드 API 키 없음 — 키워드만 사용 가능</span>
        )}
      </div>

      {/* keyword + actions */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (provider) loadTrends();
            else suggest();
          }}
          placeholder={provider ? "키워드(선택) — 비우면 인기 트렌드" : "키워드를 입력하세요"}
          className="min-w-[220px] flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
        {provider ? (
          <button
            onClick={loadTrends}
            disabled={loadingTrends}
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-ink transition-all duration-200 hover:border-empathy disabled:opacity-40"
          >
            {loadingTrends ? "불러오는 중…" : "트렌드 불러오기"}
          </button>
        ) : null}
        <button
          onClick={suggest}
          disabled={loadingTopic}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-primary-dark active:scale-[0.98] disabled:opacity-40"
        >
          {loadingTopic ? "추천 받는 중…" : "주제 추천 받기"}
        </button>
      </div>

      {err && <p className="mb-3 text-xs text-danger">{err}</p>}

      {/* trend terms (selectable) */}
      {trends.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {trends.map((t) => {
            const on = selected.has(t.term);
            return (
              <button
                key={t.term + t.source}
                onClick={() => toggle(t.term)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all duration-200 ${on ? "border-empathy bg-empathy/10 text-ink" : "border-border text-muted hover:border-empathy"}`}
              >
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${KIND_CLASS[t.kind]}`}>{KIND_LABEL[t.kind]}</span>
                {t.term}
              </button>
            );
          })}
        </div>
      )}

      {/* curated candidates */}
      {candidates.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {candidates.map((c, i) => {
            const on = chosen?.term === c.term && loc(chosen.headline, language) === loc(c.headline, language);
            return (
              <button
                key={c.term + i}
                onClick={() => onPick(on ? null : c)}
                className={`rounded-lg border p-3 text-left transition-all duration-200 ${on ? "border-empathy bg-empathy/5 ring-1 ring-empathy" : "border-border bg-surface hover:border-empathy hover:-translate-y-px"}`}
              >
                <div className="text-sm font-bold text-ink">{loc(c.headline, language)}</div>
                <div className="mt-2 rounded-md bg-ink/5 px-2 py-1.5 text-[11px] text-ink/80">
                  <span className="font-semibold text-ink">🎨 본론 프롬프트</span> · {c.comparePrompt}
                </div>
                {c.why && <div className="mt-1 text-[11px] text-empathy">{c.why}</div>}
                {on && <div className="mt-1.5 text-[11px] font-semibold text-empathy">✓ 선택됨</div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
