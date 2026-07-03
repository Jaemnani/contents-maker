"use client";
// Per-page inspector: source type/source, the 3 template dropdowns (catalog-driven,
// filtered by compatibleSourceTypes), caption/VO text, duration override + warnings.
import type { AdPage, AdProject } from "@/lib/ad/schema";
import Select, { type SelectOption } from "@/components/ui/Select";
import type { TemplateMeta } from "@/remotion/ad/types";
import SourceChooser from "@/components/ad/SourceChooser";
import TemplatePicker from "@/components/ad/TemplatePicker";
import PagePreview from "@/components/ad/PagePreview";
import { registry, DEFAULT_VISUAL, DEFAULT_MOTION } from "@/remotion/ad/templates/registry";
import { visualSourceSlots } from "@/remotion/ad/templates/meta";
import { fileUrl } from "@/lib/client/wizard";

const CAPTION_MAX = 20;

function templateMetas(cat: "visual" | "motion", sourceType: "image" | "video"): TemplateMeta[] {
  return Object.values(registry[cat])
    .map((t) => t.meta)
    .filter((m) => (m.compatibleSourceTypes ?? ["image", "video"]).includes(sourceType));
}
const transitionMetas: TemplateMeta[] = Object.values(registry.transition).map((t) => t.meta);

// fonts (remotion/ad/lib/fonts.ts — Pretendard local + @remotion/google-fonts)
const TITLE_FONTS: SelectOption[] = [
  { value: "Pretendard", label: "프리텐다드 (한글 기본)" },
  { value: "Black Han Sans", label: "검은고딕 (임팩트 한글)" },
  { value: "Do Hyeon", label: "도현 (굵은 고딕)" },
  { value: "Jua", label: "주아 (둥근 한글)" },
  { value: "Gothic A1", label: "고딕 A1" },
  { value: "Nanum Myeongjo", label: "나눔명조 (세리프)" },
  { value: "Nanum Pen Script", label: "나눔손글씨 (펜)" },
  { value: "Bebas Neue", label: "베바스 (영문 임팩트)" },
  { value: "Montserrat", label: "몽세라 (영문 모던)" },
  { value: "Elms Sans", label: "Elms Sans (영문)" },
];
const TITLE_EFFECTS: SelectOption[] = [
  { value: "fade", label: "기본 페이드 (깔끔)" },
  { value: "film", label: "반투명 필름 + 써지듯" },
  { value: "blur", label: "블러 인 (초점 맞듯)" },
  { value: "rise", label: "아래에서 솟아오름" },
  { value: "slide", label: "옆에서 슬라이드" },
  { value: "pop", label: "팝 (탄성)" },
  { value: "stamp", label: "스탬프 (찍히듯)" },
  { value: "neon", label: "네온 글로우" },
];
const TITLE_BACKDROPS: SelectOption[] = [
  { value: "banner", label: "브랜드 배너 (알약)" },
  { value: "outline", label: "외곽선 (테두리)" },
  { value: "none", label: "없음 (글자만)" },
  { value: "panel", label: "반투명 패널" },
  { value: "glass", label: "글래스 (프로스트)" },
  { value: "highlight", label: "형광펜 밑줄" },
  { value: "scrim", label: "검은 그라데이션" },
];

export default function PageInspector({
  project,
  page,
  imageModels,
  onPatch,
  onProductName,
  onTts,
  ttsBusy,
  onFlush,
}: {
  project: AdProject;
  page: AdPage;
  imageModels: SelectOption[];
  onPatch: (patch: Partial<AdPage>) => void;
  onProductName: (name: string) => void;
  onTts?: (pageId: string) => void;
  ttsBusy?: boolean;
  onFlush?: () => Promise<void>;
}) {
  const visMetas = templateMetas("visual", page.sourceType);
  const motMetas = templateMetas("motion", page.sourceType);
  const brand = project.product.brandColor;

  function switchSourceType(t: "image" | "video") {
    if (t === page.sourceType) return;
    const visOk = (registry.visual[page.visualTemplateId]?.meta.compatibleSourceTypes ?? ["image", "video"]).includes(t);
    const motOk = (registry.motion[page.motionTemplateId]?.meta.compatibleSourceTypes ?? ["image", "video"]).includes(t);
    onPatch({
      sourceType: t,
      source: { kind: "none" },
      sourceB: { kind: "none" },
      sourceC: { kind: "none" },
      sourceD: { kind: "none" },
      visualTemplateId: visOk ? page.visualTemplateId : DEFAULT_VISUAL,
      motionTemplateId: motOk ? page.motionTemplateId : DEFAULT_MOTION,
    });
  }

  const slots = visualSourceSlots(page.visualTemplateId);
  const hasTitle = !!registry.visual[page.visualTemplateId]?.meta.hasTitle;
  const isCompare = page.visualTemplateId === "compare-2up";
  // per-layout text-style defaults (big title vs caption banner)
  const defBackdrop = hasTitle ? "outline" : "banner";
  const effBackdrop = page.titleBackdrop ?? defBackdrop;
  const defSize = hasTitle ? 84 : 56;
  const defWeight = hasTitle ? 900 : 800;
  const defPad = hasTitle ? 34 : 28;
  const padBackdrop = effBackdrop === "panel" || effBackdrop === "glass" || effBackdrop === "banner";

  const voOverrun = page.durationOverrideSec != null && page.voAudio != null && page.durationOverrideSec < page.voAudio.durationSec;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_200px]">
      {/* LEFT: the editing controls (the important part comes first) */}
      <div className="flex flex-col gap-4">
        {/* product name — global, but edited here (shows in the '제목 강조' layout badge) */}
        <section>
          <div className="mb-1 text-xs font-semibold text-muted">제품명 <span className="font-normal">(전체 공통 · ‘제목 강조’ 레이아웃 배지)</span></div>
          <input
            value={project.product.name}
            onChange={(e) => onProductName(e.target.value)}
            placeholder="예: TapNow"
            className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-base outline-none focus:border-primary"
          />
        </section>

        {/* source type + source */}
        <section>
          <div className="mb-1.5 flex items-center gap-3">
            <span className="text-xs font-semibold text-muted">소스</span>
            <div className="flex gap-1">
              {(["image", "video"] as const).map((t) => (
                <button key={t} onClick={() => switchSourceType(t)} className={`rounded-md border px-2.5 py-1 text-xs transition-all duration-200 ${page.sourceType === t ? "border-empathy bg-empathy/10 text-ink" : "border-border text-muted hover:border-empathy"}`}>
                  {t === "image" ? "이미지" : "영상"}
                </button>
              ))}
            </div>
          </div>
          <div className={slots.length > 1 ? "grid gap-3 sm:grid-cols-2" : "flex flex-col gap-3"}>
            {slots.map((s, i) => {
              const compareField = isCompare && s.key === "A" ? "compareLabelA" : isCompare && s.key === "B" ? "compareLabelB" : null;
              return (
                <div key={s.key}>
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-empathy">
                    {slots.length > 1 && <span className="grid h-4 w-4 place-items-center rounded bg-empathy/15 text-[10px]">{i + 1}</span>}
                    {s.label}
                  </div>
                  <SourceChooser project={project} page={page} imageModels={imageModels} onPatch={onPatch} onFlush={onFlush} slot={s.key} />
                  {compareField && (
                    <input
                      value={(page[compareField] as string | undefined) ?? ""}
                      onChange={(e) => onPatch({ [compareField]: e.target.value || undefined } as Partial<AdPage>)}
                      placeholder={`${s.key} 옆 제목 (예: ${s.key === "A" ? "변환 전" : "변환 후"})`}
                      className="mt-1.5 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-primary"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* templates — compact thumb pickers, stacked vertically (레이아웃 → 움직임 → 전환) */}
        <section className="flex flex-col gap-3">
          <div>
            <div className="mb-1 text-xs font-semibold text-muted">레이아웃</div>
            <TemplatePicker category="visual" options={visMetas} value={page.visualTemplateId} onChange={(v) => onPatch({ visualTemplateId: v })} brand={brand} compact />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-muted">움직임</div>
            <TemplatePicker category="motion" options={motMetas} value={page.motionTemplateId} onChange={(v) => onPatch({ motionTemplateId: v })} brand={brand} compact />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-muted">전환 <span className="font-normal">(다음으로)</span></div>
            <TemplatePicker category="transition" options={transitionMetas} value={page.transitionTemplateId} onChange={(v) => onPatch({ transitionTemplateId: v })} brand={brand} compact />
          </div>
        </section>

        {/* caption / vo — stacked vertically (narration below the title, not beside it) */}
        <section className="flex flex-col gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted">
              <span>{hasTitle ? "제목 (caption)" : "자막 (caption)"}</span>
              <span className={page.caption.length > CAPTION_MAX ? "text-warning" : ""}>
                {page.caption.length}/{CAPTION_MAX}
              </span>
            </div>
            <textarea value={page.caption} onChange={(e) => onPatch({ caption: e.target.value })} className="h-14 w-full resize-y rounded-md border border-border bg-surface p-2 text-base outline-none focus:border-primary" />
            {/* text style — applies to this page's on-screen text in every layout */}
            <div className="mt-1.5 flex flex-col gap-1.5 rounded-md border border-border bg-surface-muted/30 p-2">
              <div className="text-[11px] font-semibold text-muted">글자 스타일</div>
              {hasTitle && (
                <div className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-[11px] text-muted">위치</span>
                  <div className="flex gap-1">
                    {([["top", "상단"], ["middle", "중단"], ["bottom", "하단"]] as const).map(([v, label]) => {
                      const on = (page.titlePosition ?? "top") === v;
                      return (
                        <button key={v} onClick={() => onPatch({ titlePosition: v })} className={`rounded-md border px-2.5 py-1 text-[11px] transition-all duration-200 ${on ? "border-empathy bg-empathy/10 text-ink" : "border-border text-muted hover:border-empathy"}`}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[11px] text-muted">글꼴</span>
                <Select value={page.titleFont || "Pretendard"} options={TITLE_FONTS} onChange={(v) => onPatch({ titleFont: v })} />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[11px] text-muted">크기</span>
                <input type="range" min={24} max={160} step={2} value={page.titleSize ?? defSize} onChange={(e) => onPatch({ titleSize: parseInt(e.target.value, 10) })} className="flex-1" />
                <span className="w-9 shrink-0 text-right text-[11px] text-muted">{page.titleSize ?? defSize}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[11px] text-muted">굵기</span>
                <div className="flex gap-1">
                  {([[400, "보통"], [600, "약간"], [900, "굵게"]] as const).map(([w, label]) => {
                    const on = (page.titleWeight ?? defWeight) === w;
                    return (
                      <button key={w} onClick={() => onPatch({ titleWeight: w })} className={`rounded-md border px-2.5 py-1 text-[11px] transition-all duration-200 ${on ? "border-empathy bg-empathy/10 text-ink" : "border-border text-muted hover:border-empathy"}`}>
                        {label}
                      </button>
                    );
                  })}
                  <button onClick={() => onPatch({ titleItalic: !page.titleItalic })} className={`ml-1 rounded-md border px-2.5 py-1 text-[11px] italic transition-all duration-200 ${page.titleItalic ? "border-empathy bg-empathy/10 text-ink" : "border-border text-muted hover:border-empathy"}`}>
                    기울임
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[11px] text-muted">자간</span>
                <input type="range" min={-8} max={24} step={1} value={page.titleLetterSpacing ?? 0} onChange={(e) => onPatch({ titleLetterSpacing: parseInt(e.target.value, 10) })} className="flex-1" />
                <span className="w-9 shrink-0 text-right text-[11px] text-muted">{page.titleLetterSpacing ?? 0}</span>
                <input type="color" value={page.titleColor || "#ffffff"} onChange={(e) => onPatch({ titleColor: e.target.value })} title="글자 색" className="h-7 w-8 shrink-0 cursor-pointer rounded border border-border bg-surface" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[11px] text-muted">효과</span>
                <Select value={page.titleEffect || "fade"} options={TITLE_EFFECTS} onChange={(v) => onPatch({ titleEffect: v as NonNullable<AdPage["titleEffect"]> })} />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[11px] text-muted">배경</span>
                <Select value={effBackdrop} options={TITLE_BACKDROPS} onChange={(v) => onPatch({ titleBackdrop: v as NonNullable<AdPage["titleBackdrop"]> })} />
              </div>
              {padBackdrop && (
                <div className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-[11px] text-muted">여백</span>
                  <input type="range" min={8} max={80} step={2} value={page.titlePadding ?? defPad} onChange={(e) => onPatch({ titlePadding: parseInt(e.target.value, 10) })} className="flex-1" />
                  <span className="w-9 shrink-0 text-right text-[11px] text-muted">{page.titlePadding ?? defPad}</span>
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted">
              <span>내레이션 (VO)</span>
              {onTts && (
                <button onClick={() => onTts(page.id)} disabled={ttsBusy || !page.vo.trim()} className="rounded border border-border px-2 py-0.5 text-[11px] text-ink transition-all duration-200 hover:border-empathy disabled:opacity-40">
                  {ttsBusy ? "생성 중…" : page.voAudio ? "VO 재생성" : "VO 생성"}
                </button>
              )}
            </div>
            <textarea value={page.vo} onChange={(e) => onPatch({ vo: e.target.value })} className="h-14 w-full resize-y rounded-md border border-border bg-surface p-2 text-base outline-none focus:border-primary" />
            {page.voAudio && (
              <div className="mt-1.5 flex items-center gap-2">
                <audio controls src={fileUrl(page.voAudio.path)} className="h-8 w-full" />
                <span className="shrink-0 text-[11px] text-muted">{page.voAudio.durationSec.toFixed(1)}s</span>
              </div>
            )}
          </div>
        </section>

        {/* duration */}
        <section>
          <div className="mb-1 text-xs text-muted">페이지 길이</div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${page.durationOverrideSec == null ? "bg-empathy/15 text-empathy" : "bg-ink/10 text-muted"}`}>
              {page.durationOverrideSec == null ? (page.voAudio ? "VO 자동" : "기본값") : "수동"}
            </span>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={page.durationOverrideSec ?? ""}
              placeholder={page.voAudio ? page.voAudio.durationSec.toFixed(1) : "3"}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onPatch({ durationOverrideSec: Number.isFinite(v) && v > 0 ? v : undefined });
              }}
              className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-base outline-none focus:border-primary"
            />
            <span className="text-xs text-muted">초 (비우면 자동)</span>
          </div>
          {voOverrun && (
            <p className="mt-1.5 text-xs text-warning">
              ⚠️ 수동 길이가 VO({page.voAudio!.durationSec.toFixed(1)}s)보다 짧습니다 — VO가 다음 페이지로 이어집니다.
            </p>
          )}
        </section>
      </div>

      {/* RIGHT: this-page preview (reference, alongside — not pushing controls down) */}
      <aside>
        <div className="xl:sticky xl:top-4">
          <div className="mb-1.5 text-xs font-semibold text-muted">이 페이지</div>
          <PagePreview project={project} page={page} />
        </div>
      </aside>
    </div>
  );
}
