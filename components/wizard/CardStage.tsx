"use client";
// Start/End card editor: copy (in primary language), text mode, position, background, duration.
// End card additionally supports a centered logo upload + CTA text element.
import { useState } from "react";
import type { Composition, Stage, StageImage, TextPos, CardElement } from "@/lib/composition-types";
import type { Language } from "@/lib/types";
import { CTA_PRESETS } from "@/lib/render/strings";
import { LANGUAGE_LABELS } from "@/lib/channels";
import { uploadFile, assetUrl, translateText } from "@/lib/client/wizard";
import Select, { type SelectOption } from "@/components/ui/Select";
import StageImageChooser from "@/components/wizard/StageImageChooser";
import TextStyleControls from "@/components/wizard/TextStyleControls";

const inputCls = "w-full rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-primary";
const taCls = `${inputCls} resize-y leading-snug`;

const POS_OPTS: SelectOption[] = [
  { value: "center", label: "중앙" },
  { value: "top", label: "상단" },
  { value: "bottom", label: "하단" },
];

export default function CardStage({
  comp,
  stage,
  imageModels,
  onPatch,
  onComp,
}: {
  comp: Composition;
  stage: Stage;
  imageModels: SelectOption[];
  onPatch: (patch: Partial<Stage>) => void;
  onComp: (comp: Composition) => void;
}) {
  const srcLang: Language = comp.primaryLanguage;
  const isEnd = stage.id === "end";
  const [uploading, setUploading] = useState(false);
  const [logoName, setLogoName] = useState("");
  const [editLang, setEditLang] = useState<Language>(srcLang);
  const [translating, setTranslating] = useState(false);
  const lang = editLang; // which language's copy is shown/edited

  const setLT = (field: "headline" | "sub", v: string) =>
    onPatch({ [field]: { ...(stage[field] ?? {}), [lang]: v } } as Partial<Stage>);

  const elements = stage.elements ?? [];
  const updateEl = (id: string, patch: Partial<CardElement>) =>
    onPatch({ elements: elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const cta = elements.find((e) => e.id === "cta");
  const logo = elements.find((e) => e.id === "logo");

  async function onLogo(file: File) {
    setUploading(true);
    try {
      const path = await uploadFile(file, comp.compId);
      updateEl("logo", { enabled: true, assetPath: path });
    } finally {
      setUploading(false);
    }
  }

  // Auto-translate the primary-language copy into the other languages (cheapest model).
  async function autoTranslate() {
    const targets = (["ko", "ja", "en"] as Language[]).filter((l) => l !== srcLang);
    setTranslating(true);
    try {
      if (!isEnd) {
        const h = stage.headline?.[srcLang];
        const s = stage.sub?.[srcLang];
        const [ht, st] = await Promise.all([
          h ? translateText(h, srcLang, targets) : Promise.resolve({}),
          s ? translateText(s, srcLang, targets) : Promise.resolve({}),
        ]);
        onPatch({ headline: { ...stage.headline, ...ht }, sub: { ...stage.sub, ...st } });
      } else {
        const c = cta?.text?.[srcLang];
        if (c) {
          const ct = await translateText(c, srcLang, targets);
          updateEl("cta", { text: { ...cta?.text, ...ct } });
        }
      }
    } finally {
      setTranslating(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={stage.enabled}
              onChange={(e) => onPatch({ enabled: e.target.checked })}
              className="accent-primary"
            />
            이 카드 사용
          </label>
          <span className="ml-auto text-xs text-muted">길이</span>
          <input
            type="number"
            min={1}
            max={10}
            value={stage.durationSec}
            onChange={(e) => onPatch({ durationSec: Number(e.target.value) || 3 })}
            className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-base"
          />
          <span className="text-xs text-muted">초</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(["ko", "ja", "en"] as Language[]).map((l) => (
              <button
                key={l}
                onClick={() => setEditLang(l)}
                className={`rounded-md px-2 py-1 text-xs transition-colors duration-200 ${editLang === l ? "bg-primary text-white" : "text-muted hover:bg-surface-muted"}`}
              >
                {LANGUAGE_LABELS[l]}{l === srcLang ? " •" : ""}
              </button>
            ))}
          </div>
          <button
            onClick={autoTranslate}
            disabled={translating}
            className="ml-auto rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors duration-200 hover:border-empathy disabled:opacity-40"
          >
            {translating ? "번역 중…" : `자동 번역 (${LANGUAGE_LABELS[srcLang]} →)`}
          </button>
        </div>

        {!isEnd ? (
          <>
            <div>
              <label className="mb-1 block text-xs text-muted">헤드라인 ({lang}) · 줄바꿈 가능</label>
              <textarea rows={2} className={taCls} value={stage.headline?.[lang] ?? ""} onChange={(e) => setLT("headline", e.target.value)} />
              <TextStyleControls value={stage.headlineStyle} defaultSize={92} onChange={(s) => onPatch({ headlineStyle: s })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">서브 문구 ({lang}) · 줄바꿈 가능</label>
              <textarea rows={2} className={taCls} value={stage.sub?.[lang] ?? ""} onChange={(e) => setLT("sub", e.target.value)} />
              <TextStyleControls value={stage.subStyle} defaultSize={44} onChange={(s) => onPatch({ subStyle: s })} />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="mb-1 flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={cta?.enabled ?? false} onChange={(e) => updateEl("cta", { enabled: e.target.checked })} className="accent-primary" />
                CTA 문구 ({lang})
              </label>
              <textarea
                rows={2}
                className={taCls}
                value={cta?.text?.[lang] ?? ""}
                onChange={(e) => updateEl("cta", { text: { ...(cta?.text ?? {}), [lang]: e.target.value } })}
                placeholder="예: 댓글로 골라줘!"
              />
              <TextStyleControls value={cta?.style} defaultSize={64} onChange={(s) => updateEl("cta", { style: s })} />
              <div className="mt-1 flex flex-wrap gap-1">
                {CTA_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => updateEl("cta", { enabled: true, text: { ...(cta?.text ?? {}), [lang]: p.text[lang] ?? p.text.ko } })}
                    className="rounded-full border border-border px-2 py-0.5 text-xs text-muted hover:border-empathy"
                  >
                    {p.text[lang] ?? p.text.ko}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={logo?.enabled ?? false} onChange={(e) => updateEl("logo", { enabled: e.target.checked })} className="accent-primary" />
                로고 (가운데 크게)
              </label>
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-primary-dark active:scale-[0.98]">
                  로고 파일 선택
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setLogoName(f.name);
                        onLogo(f);
                      }
                    }}
                  />
                </label>
                <span className="text-xs text-muted">
                  {uploading ? "업로드 중…" : logoName || (logo?.assetPath ? logo.assetPath.split("/").pop() : "선택된 파일 없음")}
                </span>
              </div>
              {logo?.assetPath && (
                <div className="mt-2 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={assetUrl({ datasetPath: logo.assetPath.replace(/\/[^/]+$/, ""), file: logo.assetPath.split("/").pop()! })} alt="logo" className="h-12 rounded border border-border bg-surface-muted object-contain" />
                  <label className="text-xs text-muted">
                    크기
                    <input type="range" min={200} max={960} value={logo.size ?? 720} onChange={(e) => updateEl("logo", { size: Number(e.target.value) })} className="ml-2 align-middle" />
                  </label>
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">텍스트 방식</label>
            <Select
              value={stage.textMode}
              options={[{ value: "overlay", label: "앱 오버레이" }, { value: "in-image", label: "이미지에 포함" }]}
              onChange={(v) => onPatch({ textMode: v as Stage["textMode"] })}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">텍스트 위치</label>
            <Select value={stage.textPos ?? "center"} options={POS_OPTS} onChange={(v) => onPatch({ textPos: v as TextPos })} />
          </div>
        </div>

        {stage.textMode === "in-image" && (
          <p className="rounded-md bg-accent/30 p-2 text-xs text-ink">
            <b>이미지에 포함</b>: AI 생성 시 위 문구가 이미지 안에 그려집니다. 문구를 바꾸면 <b>배경을 다시 생성</b>하세요.
            (템플릿/히스토리 배경에는 문구가 포함되지 않습니다 — 그 경우 ‘앱 오버레이’를 쓰세요.)
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted">배경</label>
        <StageImageChooser
          comp={comp}
          stageId={stage.id}
          image={stage.image}
          imageModels={imageModels}
          onSetImage={(img: StageImage) => onPatch({ image: img })}
          onComp={onComp}
        />
      </div>
    </div>
  );
}
