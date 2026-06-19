"use client";
// Endcard panel: on/off, template, brand logo (only used here), incoming transition,
// duration, CTA copy. Live preview shows exactly what renders.
import { useMemo, useState } from "react";
import type { AdProject, AdEndcard, AdProduct } from "@/lib/ad/schema";
import Select, { type SelectOption } from "@/components/ui/Select";
import { ENDCARD_METAS, TRANSITION_METAS } from "@/remotion/ad/templates/meta";
import TemplatePicker from "@/components/ad/TemplatePicker";
import AdPlayer from "@/components/ad/AdPlayer";
import { uploadFile, fileUrl } from "@/lib/client/wizard";

const transitionOptions: SelectOption[] = Object.values(TRANSITION_METAS).map((m) => ({ value: m.id, label: m.name }));

export default function EndcardPanel({
  project,
  onEndcard,
  onProduct,
}: {
  project: AdProject;
  onEndcard: (e: AdEndcard) => void;
  onProduct: (p: AdProduct) => void;
}) {
  const ec = project.endcard;
  const product = project.product;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // endcard-only preview project (no pages) so the user sees exactly what it renders
  const ecOnly = useMemo<AdProject>(
    () => ({ ...project, pages: [], endcard: { ...ec, enabled: true }, audio: { bgm: { kind: "none" } } }),
    [project, ec]
  );

  async function onLogo(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const path = await uploadFile(file, project.projectId);
      onProduct({ ...product, logoPath: path });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-bold">엔드카드 <span className="text-xs font-normal text-muted">(영상 맨 끝 마무리 화면)</span></h2>
        <button
          onClick={() => onEndcard({ ...ec, enabled: !ec.enabled })}
          className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 ${ec.enabled ? "bg-eli5 text-white" : "bg-ink/10 text-muted"}`}
        >
          {ec.enabled ? "사용" : "미사용"}
        </button>
      </div>
      {ec.enabled && (
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-3">
            <div className="w-[120px] shrink-0">
              <div className="mb-1 text-xs text-muted">미리보기</div>
              <div className="overflow-hidden rounded-md border border-border bg-ink">
                <AdPlayer project={ecOnly} controls loop autoPlay />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 text-xs text-muted">템플릿</div>
              <TemplatePicker
                category="endcard"
                options={Object.values(ENDCARD_METAS)}
                value={ec.templateId}
                onChange={(v) => onEndcard({ ...ec, templateId: v })}
                brand={product.brandColor}
                cols={1}
              />
            </div>
          </div>

          {/* brand logo — only the endcard uses it, so it lives here */}
          <div>
            <div className="mb-1 text-xs text-muted">브랜드 로고 <span className="text-[10px]">(비우면 기본 로고)</span></div>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.logoPath ? fileUrl(product.logoPath) : "/brand/logo.png"} alt="logo" className="max-h-full max-w-full object-contain" />
              </div>
              <label className="cursor-pointer rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted transition-all duration-200 hover:border-empathy">
                {busy ? "업로드 중…" : product.logoPath ? "로고 변경 (PNG 권장)" : "로고 업로드 (PNG 권장)"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
              </label>
              {product.logoPath && (
                <button onClick={() => onProduct({ ...product, logoPath: undefined })} className="text-xs text-danger hover:underline">기본값으로</button>
              )}
            </div>
            {err && <p className="mt-1 text-xs text-danger">{err}</p>}
          </div>

          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted">진입 전환</span>
            <div className="min-w-0 flex-1">
              <Select value={ec.transitionTemplateId} options={transitionOptions} onChange={(v) => onEndcard({ ...ec, transitionTemplateId: v })} />
            </div>
            <span title="마지막 페이지 → 엔드카드로 넘어갈 때의 전환 효과입니다. 이 미리보기에는 앞 페이지가 없어 보이지 않고, 오른쪽 ‘전체 미리보기’나 렌더에서 확인됩니다." className="shrink-0 cursor-help text-xs text-muted">ⓘ</span>
            <span className="shrink-0 text-xs text-muted">길이</span>
            <input
              type="number" min={1} step={0.5}
              value={ec.durationSec}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v) && v > 0) onEndcard({ ...ec, durationSec: v });
              }}
              className="w-16 rounded-md border border-border bg-surface px-2 py-1.5 text-base outline-none focus:border-primary"
            />
            <span className="shrink-0 text-xs text-muted">초</span>
          </div>
          {/* the editable text follows the chosen template: logo-cta → CTA, logo-blur-in → one-liner */}
          {ec.templateId === "logo-cta" ? (
            <div>
              <div className="mb-1 text-xs text-muted">CTA 문구 <span className="text-[10px]">(이 템플릿이 보여주는 버튼 · 비우면 제품 CTA · 줄바꿈 가능)</span></div>
              <textarea
                value={ec.cta ?? ""}
                onChange={(e) => onEndcard({ ...ec, cta: e.target.value || undefined })}
                placeholder={product.cta}
                className="h-14 w-full resize-y rounded-md border border-border bg-surface p-2 text-base outline-none focus:border-primary"
              />
            </div>
          ) : (
            <div>
              <div className="mb-1 text-xs text-muted">한 줄 소개 <span className="text-[10px]">(이 템플릿이 로고 아래 보여주는 문구 · 비우면 제품 한 줄 소개 · 줄바꿈 가능)</span></div>
              <textarea
                value={ec.subtitle ?? ""}
                onChange={(e) => onEndcard({ ...ec, subtitle: e.target.value || undefined })}
                placeholder={product.oneLiner}
                className="h-14 w-full resize-y rounded-md border border-border bg-surface p-2 text-base outline-none focus:border-primary"
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
