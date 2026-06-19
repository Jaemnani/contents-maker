"use client";
// Landing: "new short" setup + recent projects list. Mounts the Wizard for an active composition.
import { useEffect, useState } from "react";
import type { Composition, SourceType } from "@/lib/composition-types";
import type { Language } from "@/lib/types";
import { LANGUAGE_LABELS } from "@/lib/channels";
import { TOPICS, DEFAULT_TOPIC_ID, pickText } from "@/lib/render/strings";
import { createComposition, saveComposition, listCompositions, getComposition, assetThumbUrl, type TopicCandidate } from "@/lib/client/wizard";
import Wizard from "@/components/wizard/Wizard";
import TopicSuggest from "@/components/wizard/TopicSuggest";

const LANGS: Language[] = ["ko", "ja", "en"];

export default function Home() {
  const [comp, setComp] = useState<Composition | null>(null);
  const [recent, setRecent] = useState<Composition[]>([]);
  const [sourceType, setSourceType] = useState<SourceType>("image");
  const [language, setLanguage] = useState<Language>("ko");
  const [topicId, setTopicId] = useState<string>(DEFAULT_TOPIC_ID);
  const [chosen, setChosen] = useState<TopicCandidate | null>(null);
  const [creating, setCreating] = useState(false);

  function refresh() {
    listCompositions().then(setRecent).catch(() => setRecent([]));
  }
  useEffect(() => {
    if (!comp) refresh();
  }, [comp]);

  async function create() {
    setCreating(true);
    try {
      // Start/end cards always use the selected topic TEMPLATE. A recommended topic only
      // supplies the main comparison-pair prompt (+ a readable label for the recent list).
      const c = await createComposition(sourceType, language, topicId);
      if (chosen) {
        c.comparePrompt = chosen.comparePrompt;
        c.topicTitle = pickText(chosen.headline, language);
        setComp(await saveComposition(c));
      } else {
        setComp(c);
      }
    } finally {
      setCreating(false);
    }
  }

  if (comp) return <Wizard comp={comp} onExit={() => setComp(null)} />;

  return (
    <main className="mx-auto w-full max-w-[1280px] grow px-5 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Shorts <span className="text-primary">Maker</span>
          </h1>
          <p className="text-sm text-muted">같은 프롬프트 다른 AI — 9:16 비교 숏폼</p>
        </div>
        <div className="flex gap-2">
          <a href="/ad" className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted transition-colors duration-200 hover:border-empathy hover:text-ink">
            광고 메이커 →
          </a>
          <a href="/studio" className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted transition-colors duration-200 hover:border-empathy hover:text-ink">
            Source Studio →
          </a>
        </div>
      </header>

      <section className="mb-8 rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-base font-bold">새 영상 만들기</h2>
        <div className="flex flex-wrap items-end gap-5">
          <div>
            <div className="mb-1 text-xs text-muted">비교 타입</div>
            <div className="flex gap-2">
              {(["image", "video"] as SourceType[]).map((t) => (
                <button key={t} onClick={() => setSourceType(t)} className={`rounded-md border px-4 py-2 text-sm transition-all duration-200 ${sourceType === t ? "border-empathy bg-empathy/10 text-ink" : "border-border text-muted hover:border-empathy"}`}>
                  {t === "image" ? "이미지" : "영상"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted">기본 언어</div>
            <div className="flex gap-2">
              {LANGS.map((l) => (
                <button key={l} onClick={() => setLanguage(l)} className={`rounded-md border px-4 py-2 text-sm transition-all duration-200 ${language === l ? "border-empathy bg-empathy/10 text-ink" : "border-border text-muted hover:border-empathy"}`}>
                  {LANGUAGE_LABELS[l]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted">주제 템플릿 <span className="text-[10px]">(시작·끝 카드)</span></div>
            <div className="flex gap-2">
              {Object.values(TOPICS).map((t) => (
                <button key={t.id} onClick={() => setTopicId(t.id)} className={`rounded-md border px-4 py-2 text-sm transition-all duration-200 ${topicId === t.id ? "border-empathy bg-empathy/10 text-ink" : "border-border text-muted hover:border-empathy"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={create} disabled={creating} className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-primary-dark active:scale-[0.98] disabled:opacity-40">
            {creating ? "생성 중…" : "시작 →"}
          </button>
        </div>

        <TopicSuggest language={language} chosen={chosen} onPick={setChosen} />
        {chosen && (
          <p className="mt-2 text-xs text-empathy">
            선택된 주제: <span className="font-semibold">{pickText(chosen.headline, language)}</span> — 본론 비교 쌍 생성 프롬프트로 사용됩니다. (시작·끝 카드는 템플릿 그대로)
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-bold">최근 작업</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">아직 작업이 없습니다. 위에서 새 영상을 시작하세요.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {recent.map((c) => {
              const main = c.stages.find((s) => s.id === "main");
              const thumb = main?.aRef ? assetThumbUrl(main.aRef) : null;
              return (
                <button
                  key={c.compId}
                  onClick={() => getComposition(c.compId).then(setComp)}
                  className="overflow-hidden rounded-lg border border-border bg-surface text-left transition-all duration-200 hover:border-empathy hover:-translate-y-px"
                >
                  <div className="aspect-[9/16] w-full bg-ink/5">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-xs text-muted">미리보기 없음</div>
                    )}
                  </div>
                  <div className="px-2 py-1.5">
                    <div className="truncate text-xs font-medium text-ink">{c.topicTitle || TOPICS[c.topicId]?.label || c.compId}</div>
                    <div className="text-[11px] text-muted">{c.sourceType} · {new Date(c.createdAt).toLocaleString()}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
