"use client";
// aib 콘텐츠 팩토리 — stage 위자드 (SKILL 6 STEP의 L1 구현).
// 사람이 정하는 세 지점(주제 택1 · 포맷 확정 · 소재 붙여넣기)에서 멈추고,
// 생성(STEP4~6)은 한 번에 자동으로 돈다. 서버가 전이시킨 프로젝트를 onApply로 넘긴다.
import { useState } from "react";
import type { AdProject, ChannelOutput, ContentType, FactoryCategory, FactoryTopic, FormatKind } from "@/lib/ad/schema";
import { factoryOp } from "@/lib/client/ad";
import Select from "@/components/ui/Select";
import {
  CATEGORY_LABELS,
  CATEGORY_TYPE_AFFINITY,
  CHANNEL_LABELS,
  CHANNEL_SPECS,
  CONTENT_TYPE_HINTS,
  CONTENT_TYPE_LABELS,
  FORMAT_LABELS,
  STAGE_LABELS,
  recommendFormats,
} from "@/lib/ad/factory/presets";

const CATEGORY_OPTIONS = (Object.keys(CATEGORY_LABELS) as FactoryCategory[]).map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));
const SCORE_GLYPH: Record<"high" | "mid" | "low", string> = { high: "◎", mid: "○", low: "△" };
const ALL_TYPES = Object.keys(CONTENT_TYPE_LABELS) as ContentType[];
const ALL_FORMATS = Object.keys(FORMAT_LABELS) as FormatKind[];

/** 채널 출력 1건 → 클립보드용 텍스트 (2단 구성은 구분선으로). */
function outputText(o: ChannelOutput): string {
  const tagLine = o.tags.length ? o.tags.map((t) => `#${t}`).join(" ") : "";
  if (o.parts?.length) return [o.title, o.parts.join("\n\n--- (2번 게시물) ---\n\n"), tagLine].filter(Boolean).join("\n\n");
  return [o.title, o.body, tagLine].filter(Boolean).join("\n\n");
}

export default function FactoryPanel({
  project,
  disabled,
  onApply,
  onFlush,
}: {
  project: AdProject;
  disabled: boolean;
  onApply: (p: AdProject) => void;
  onFlush: () => Promise<void>;
}) {
  const f = project.factory;
  const [open, setOpen] = useState(!!f && f.stage !== "published");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(""); // 생성 중 진행 문구
  const [errMsg, setErrMsg] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // ── 로컬 폼 상태 (stage 제출 전까지는 서버에 안 씀) ──
  const [title, setTitle] = useState(f?.topic?.title ?? "");
  const [category, setCategory] = useState<FactoryCategory>(f?.topic?.category ?? "ai");
  const [types, setTypes] = useState<ContentType[]>(f?.topic?.supportedTypes ?? []);
  const [formats, setFormats] = useState<FormatKind[]>(f?.formatPreset?.selected ?? []);
  const [question, setQuestion] = useState(f?.source?.question ?? "");
  const [searchMode, setSearchMode] = useState<"off" | "on">(f?.source?.searchMode ?? "off");
  const [modelAName, setModelAName] = useState(f?.source?.modelA.name ?? "클로드");
  const [modelAAnswer, setModelAAnswer] = useState(f?.source?.modelA.answer ?? "");
  const [modelBName, setModelBName] = useState(f?.source?.modelB.name ?? "제미나이");
  const [modelBAnswer, setModelBAnswer] = useState(f?.source?.modelB.answer ?? "");
  const [factNote, setFactNote] = useState(f?.source?.factNote ?? "");

  const gated = disabled || busy;

  async function run(op: () => Promise<AdProject>, phaseText = "") {
    setBusy(true);
    setErrMsg("");
    setPhase(phaseText);
    try {
      await onFlush(); // 서버 op는 디스크의 최신 프로젝트를 읽는다
      onApply(await op());
    } catch (e) {
      setErrMsg((e as Error).message);
    } finally {
      setBusy(false);
      setPhase("");
    }
  }

  function fetchCandidates() {
    void run(() => factoryOp(project.projectId, { op: "candidates" }), "트렌드 수집·스코어링 중… (30초~1분)");
  }

  function pickCandidate(c: FactoryTopic) {
    // 로컬 폼도 동기화 — 이후 '직접 입력' 폼을 열어도 선택값이 반영돼 있게
    setTitle(c.title);
    setCategory(c.category);
    setTypes(c.supportedTypes);
    void run(async () => {
      const p = await factoryOp(project.projectId, { op: "topic", topic: c });
      setFormats(p.factory?.formatPreset?.selected ?? recommendFormats(c.supportedTypes));
      return p;
    });
  }

  function submitTopic() {
    if (!title.trim()) return setErrMsg("주제를 입력하세요.");
    if (!types.length) return setErrMsg("이 주제가 성립시키는 콘텐츠 유형을 1개 이상 선택하세요.");
    const t = { title: title.trim(), category, supportedTypes: types };
    void run(async () => {
      const p = await factoryOp(project.projectId, { op: "topic", topic: t });
      setFormats(p.factory?.formatPreset?.selected ?? recommendFormats(types));
      return p;
    });
  }

  function submitFormats() {
    if (!formats.length) return setErrMsg("포맷을 1개 이상 선택하세요.");
    void run(() => factoryOp(project.projectId, { op: "formats", selected: formats }));
  }

  function submitSourceAndPackage() {
    const source = {
      kind: "text" as const,
      question: question.trim(),
      searchMode,
      modelA: { name: modelAName.trim() || "모델A", answer: modelAAnswer.trim() },
      modelB: { name: modelBName.trim() || "모델B", answer: modelBAnswer.trim() },
      factNote: factNote.trim() || undefined,
      assets: [],
    };
    const wantsVideo = (project.factory?.formatPreset?.selected ?? []).some((x) => x === "shorts" || x === "ugc_demo");
    if (wantsVideo && project.pages.length > 0 && !confirm("쇼츠 생성 시 이 프로젝트의 기존 페이지가 새 5컷 구성으로 교체됩니다. 진행할까요?")) return;
    void run(async () => {
      await factoryOp(project.projectId, { op: "source", source });
      return factoryOp(project.projectId, { op: "package" });
    }, "콘텐츠 생성 중… (골자 → 채널 카피 → 쇼츠 컷 → 사실확인, 1~2분)");
  }

  async function copyOutput(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      setErrMsg("클립보드 복사 실패 — 직접 선택해 복사하세요.");
    }
  }

  const toggle = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const chip = (on: boolean) =>
    `rounded-md border px-2.5 py-1 text-[12px] transition-all duration-200 ${on ? "border-empathy bg-empathy/10 text-ink" : "border-border text-muted hover:border-empathy"}`;
  const label = "mb-1 text-xs font-semibold text-muted";
  const input = "w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-primary";
  const primaryBtn = "rounded-md bg-eli5 px-3 py-1.5 text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 disabled:opacity-40";

  const stage = f?.stage;
  return (
    <section className="mb-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-sm font-bold text-ink">
          <span className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}>▸</span>
          aib 콘텐츠 팩토리
        </button>
        {stage && <span className="rounded-full bg-empathy/15 px-2 py-0.5 text-[11px] font-semibold text-empathy">{STAGE_LABELS[stage] ?? stage}</span>}
        <span className="text-[11px] text-muted">주제 1개 → 여러 채널 콘텐츠 세트 (쇼츠는 이 프로젝트로 렌더)</span>
        <div className="ml-auto flex items-center gap-2">
          {busy && <span className="text-[11px] text-muted">{phase || "처리 중…"}</span>}
          {f && (
            <button
              onClick={() => {
                if (confirm("팩토리 상태를 초기화할까요? (생성된 페이지·카피는 유지되지 않는 것은 없고, 배치 상태만 초기화됩니다)")) void run(() => factoryOp(project.projectId, { op: "reset" }));
              }}
              disabled={gated}
              className="rounded border border-border px-2 py-0.5 text-[11px] text-muted hover:border-warning hover:text-warning disabled:opacity-40"
            >
              초기화
            </button>
          )}
        </div>
      </div>
      {errMsg && <p className="mt-2 text-xs text-warning">{errMsg}</p>}

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {/* STEP1 · 주제 후보 추천 [반자동 → 택1] — 트렌드 수집이 기본, 직접 입력은 폴백 */}
          {(!f || stage === "topic_candidates" || stage === "format_preset") && (
            <div className="rounded-md border border-border/60 bg-surface-muted/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={label.replace("mb-1 ", "")}>① 주제 후보 (최근 화제 → 카테고리별 수집 → 3개 추천)</span>
                <button onClick={fetchCandidates} disabled={gated} className={`ml-auto ${f?.candidates?.length ? "rounded-md border border-border px-3 py-1.5 text-sm text-ink hover:border-empathy disabled:opacity-40" : primaryBtn}`}>
                  {f?.candidates?.length ? "↻ 다시 추천받기" : "🔥 트렌드에서 후보 3개 추천받기"}
                </button>
              </div>

              {/* 후보 3장 — 택1 */}
              {stage === "topic_candidates" && !!f?.candidates?.length && (
                <div className="mt-2 grid gap-2 lg:grid-cols-3">
                  {f.candidates.map((c, i) => (
                    <div key={i} className="flex flex-col gap-1.5 rounded-md border border-border bg-surface p-2.5">
                      <div className="flex items-start gap-1.5">
                        <span className="shrink-0 rounded bg-empathy/15 px-1.5 py-0.5 text-[10px] font-semibold text-empathy">{CATEGORY_LABELS[c.category]}</span>
                        <span className="text-sm font-bold leading-snug text-ink">{["①", "②", "③"][i]} {c.title}</span>
                      </div>
                      {c.scores && (
                        <div className="text-[11px] text-muted">
                          트렌드{SCORE_GLYPH[c.scores.trend]} 적합{SCORE_GLYPH[c.scores.fit]} 후킹{SCORE_GLYPH[c.scores.hook]}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {c.supportedTypes.map((t) => (
                          <span key={t} className="rounded bg-ink/10 px-1.5 py-0.5 text-[10px] text-muted">{CONTENT_TYPE_LABELS[t]}</span>
                        ))}
                      </div>
                      {c.typeNote && <div className="text-[11px] leading-snug text-muted">{c.typeNote}</div>}
                      {c.sourceNote && <div className="text-[10px] leading-snug text-muted/80">출처: {c.sourceNote}</div>}
                      <button onClick={() => pickCandidate(c)} disabled={gated} className={`mt-auto ${primaryBtn}`}>
                        이 주제로 진행 →
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 선택된 주제 표시 */}
              {stage === "format_preset" && f?.topic && (
                <p className="mt-2 text-xs text-ink">
                  ✅ 선택된 주제: <span className="rounded bg-empathy/15 px-1.5 py-0.5 text-[10px] font-semibold text-empathy">{CATEGORY_LABELS[f.topic.category]}</span>{" "}
                  <b>{f.topic.title}</b> <span className="text-muted">({f.topic.supportedTypes.map((t) => CONTENT_TYPE_LABELS[t]).join(" · ")})</span>
                </p>
              )}

              {/* 직접 입력 — 트렌드 키가 없거나 이미 정한 주제가 있을 때의 폴백 */}
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-muted hover:text-ink">주제 직접 입력 (추천 대신)</summary>
                <div className="mt-2 flex flex-wrap items-start gap-2">
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder='예: 삼성전자 2분기 89조 영업이익, AI들은 믿을까' className={`${input} min-w-64 flex-1`} disabled={gated} />
                  <div className="w-36 shrink-0">
                    <Select value={category} options={CATEGORY_OPTIONS} onChange={(v) => setCategory(v as FactoryCategory)} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-muted">성립하는 유형:</span>
                  {ALL_TYPES.map((t) => (
                    <button key={t} onClick={() => setTypes((x) => toggle(x, t))} title={CONTENT_TYPE_HINTS[t]} className={chip(types.includes(t))} disabled={gated}>
                      {CONTENT_TYPE_LABELS[t]}
                      {CATEGORY_TYPE_AFFINITY[category].includes(t) && <span className="ml-1 text-[10px] text-empathy">잘 붙음</span>}
                    </button>
                  ))}
                  <button onClick={submitTopic} disabled={gated} className={`ml-auto ${primaryBtn}`}>
                    주제 확정 →
                  </button>
                </div>
              </details>
            </div>
          )}

          {/* STEP2 · 포맷 (추천 프리셋 기본 체크 — 사용자가 확정) */}
          {(stage === "format_preset" || stage === "awaiting_source") && (
            <div className="rounded-md border border-border/60 bg-surface-muted/30 p-3">
              <div className={label}>② 포맷 (추천이 기본 체크 — 켜고 끄세요. 글전용은 제작비 0이라 항상 추천)</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {ALL_FORMATS.map((k) => (
                  <button key={k} onClick={() => setFormats((x) => toggle(x, k))} className={chip(formats.includes(k))} disabled={gated}>
                    {formats.includes(k) ? "☑" : "☐"} {FORMAT_LABELS[k]}
                    {f?.formatPreset?.recommended.includes(k) && <span className="ml-1 text-[10px] text-empathy">추천</span>}
                  </button>
                ))}
                {stage === "format_preset" && (
                  <button onClick={submitFormats} disabled={gated} className={`ml-auto ${primaryBtn}`}>
                    포맷 확정 →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP3 · 소재 (수동 붙여넣기) → 확정 시 STEP4~6 자동 체인 */}
          {stage === "awaiting_source" && (
            <div className="rounded-md border border-border/60 bg-surface-muted/30 p-3">
              <div className={label}>③ 소재 — aib.vote 실제 비교 결과를 붙여넣으세요 (지어내지 않기)</div>
              <div className="flex flex-wrap items-center gap-2">
                <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="두 모델에게 던진 질문" className={`${input} min-w-64 flex-1`} disabled={gated} />
                <div className="flex items-center gap-1 text-[11px] text-muted">
                  검색
                  {(["off", "on"] as const).map((m) => (
                    <button key={m} onClick={() => setSearchMode(m)} className={chip(searchMode === m)} disabled={gated}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["A", modelAName, setModelAName, modelAAnswer, setModelAAnswer],
                    ["B", modelBName, setModelBName, modelBAnswer, setModelBAnswer],
                  ] as const
                ).map(([slot, name, setName, answer, setAnswer]) => (
                  <div key={slot}>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`모델${slot} 이름`} className={`${input} mb-1`} disabled={gated} />
                    <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={`모델${slot}의 답변 (복사해 붙여넣기)`} className={`${input} h-20 resize-y`} disabled={gated} />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input value={factNote} onChange={(e) => setFactNote(e.target.value)} placeholder="실제 사실 (반전 근거 — 확인된 것만, 선택)" className={`${input} min-w-64 flex-1`} disabled={gated} />
                <button onClick={submitSourceAndPackage} disabled={gated || !question.trim() || !modelAAnswer.trim() || !modelBAnswer.trim()} className={primaryBtn}>
                  {busy ? phase || "생성 중…" : "④ 콘텐츠 일괄 생성"}
                </button>
              </div>
            </div>
          )}

          {/* 결과뷰 — 채널 카피 · 사실확인 · 일정 · 로테이션 */}
          {(stage === "packaged" || stage === "rendered" || stage === "awaiting_publish" || stage === "published") && f?.plan && (
            <div className="flex flex-col gap-3">
              {(f.formatPreset?.selected ?? []).some((x) => x === "shorts" || x === "ugc_demo") && (
                <p className="rounded-md bg-empathy/10 px-3 py-2 text-xs text-ink">
                  🎬 쇼츠 5컷이 이 프로젝트의 페이지로 구성됐습니다 — 아래에서 이미지 생성·VO 생성·렌더를 진행하세요. 인스타 릴스용은 상단 비율 토글로 4:5 렌더도 함께 뽑으세요.
                </p>
              )}
              {!!f.plan.warnings?.length && (
                <ul className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning">
                  {f.plan.warnings.map((w, i) => (
                    <li key={i}>⚠️ {w}</li>
                  ))}
                </ul>
              )}
              <div>
                <div className={label}>채널별 카피 ({f.plan.outputs.length}건 — 복사해서 바로 발행)</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {f.plan.outputs.map((o, i) => {
                    const key = `${o.format}:${o.channel}:${i}`;
                    const spec = CHANNEL_SPECS[o.channel];
                    return (
                      <div key={key} className="rounded-md border border-border bg-surface p-2.5">
                        <div className="mb-1 flex items-center gap-1.5 text-[11px]">
                          <span className="font-bold text-ink">{CHANNEL_LABELS[o.channel]}</span>
                          <span className="text-muted">· {FORMAT_LABELS[o.format]}</span>
                          {o.aspectRatio && <span className="rounded bg-ink/10 px-1.5 py-0.5 text-[10px] text-muted">{o.aspectRatio}</span>}
                          {spec.note && <span className="text-[10px] text-warning">{spec.note}</span>}
                          <button onClick={() => void copyOutput(key, outputText(o))} className="ml-auto rounded border border-border px-2 py-0.5 text-[11px] text-ink hover:border-empathy">
                            {copied === key ? "복사됨 ✓" : "복사"}
                          </button>
                        </div>
                        <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink">{outputText(o)}</pre>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-md border border-warning/40 bg-warning/5 p-3">
                <div className="mb-1 text-xs font-bold text-warning">발행 전 사실확인 체크 (필수)</div>
                <ul className="flex flex-col gap-1 text-xs text-ink">
                  {f.plan.factCheck.map((c, i) => (
                    <li key={i}>
                      <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.treatedAs === "fact" ? "bg-warning/20 text-warning" : "bg-ink/10 text-muted"}`}>
                        {c.treatedAs === "fact" ? "사실로 단정됨 — 확인 필수" : "모델 발언으로 처리"}
                      </span>
                      {c.claim} <span className="text-muted">— {c.note}</span>
                    </li>
                  ))}
                  {!f.plan.factCheck.length && <li className="text-muted">목록화된 수치·주장이 없습니다.</li>}
                </ul>
              </div>
              <div className="grid gap-2 text-xs text-ink sm:grid-cols-2">
                <div className="rounded-md border border-border p-2.5">
                  <div className="mb-1 font-semibold text-muted">배포 일정 제안</div>
                  <pre className="whitespace-pre-wrap font-sans">{f.plan.schedule}</pre>
                </div>
                <div className="rounded-md border border-border p-2.5">
                  <div className="mb-1 font-semibold text-muted">로테이션 메모</div>
                  {f.plan.rotationMemo}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {stage !== "published" ? (
                  <>
                    <button onClick={() => void run(() => factoryOp(project.projectId, { op: "published" }))} disabled={gated} className={primaryBtn}>
                      발행 완료로 표시
                    </button>
                    <button onClick={() => void run(() => factoryOp(project.projectId, { op: "package" }), "다시 생성 중…")} disabled={gated} className="rounded-md border border-border px-3 py-1.5 text-sm text-ink hover:border-empathy disabled:opacity-40">
                      카피 다시 생성
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-muted">✅ 발행 완료 — 새 배치는 ‘초기화’ 후 시작하세요. 로테이션 메모를 다음 주제 선정에 반영!</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
