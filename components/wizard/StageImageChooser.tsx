"use client";
// Shared background chooser for a stage: template | ai (generate) | pick (history).
// Used by start/end cards and the optional main background.
import { useState } from "react";
import type { Composition, StageImage, StageType, AssetRef } from "@/lib/composition-types";
import { CARD_TEMPLATES } from "@/lib/render/strings";
import { generateStageBg, assetUrl } from "@/lib/client/wizard";
import Select, { type SelectOption } from "@/components/ui/Select";
import HistoryPicker from "@/components/HistoryPicker";

const DEFAULT_BG_PROMPT = "abstract vertical 9:16 background, soft depth, cinematic, no text";

export default function StageImageChooser({
  comp,
  stageId,
  image,
  imageModels,
  allowTemplate = true,
  onSetImage,
  onComp,
}: {
  comp: Composition;
  stageId: StageType;
  image: StageImage | undefined;
  imageModels: SelectOption[];
  allowTemplate?: boolean;
  onSetImage: (img: StageImage) => void; // local set + save (template/pick)
  onComp: (comp: Composition) => void; // server-returned comp (ai generate)
}) {
  const [mode, setMode] = useState<StageImage["source"]>(image?.source ?? (allowTemplate ? "template" : "pick"));
  const [model, setModel] = useState<string>(image?.genModel ?? imageModels[0]?.value ?? "");
  const [prompt, setPrompt] = useState<string>(image?.genPrompt ?? DEFAULT_BG_PROMPT);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pickOpen, setPickOpen] = useState(false);

  const modes: { id: StageImage["source"]; label: string }[] = [
    ...(allowTemplate ? [{ id: "template" as const, label: "템플릿" }] : []),
    { id: "ai", label: "AI 생성" },
    { id: "pick", label: "히스토리" },
  ];

  async function generate() {
    if (!model || !prompt.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const { composition } = await generateStageBg({ compId: comp.compId, stageId, model, prompt });
      onComp(composition);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const preview = image?.ref ? assetUrl(image.ref) : null;

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-3 flex gap-1">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`rounded-md px-3 py-1 text-sm transition-colors duration-200 ${
              mode === m.id ? "bg-primary text-white" : "text-muted hover:bg-surface-muted"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "template" && (
        <div className="flex flex-wrap gap-2">
          {CARD_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => onSetImage({ source: "template", templateId: t.id })}
              className={`h-16 w-24 overflow-hidden rounded-md border text-xs font-medium transition-all duration-200 hover:-translate-y-px ${
                image?.source === "template" && image?.templateId === t.id ? "border-empathy ring-2 ring-empathy/30" : "border-border"
              }`}
              style={{ background: t.to ? `linear-gradient(${t.from},${t.to})` : t.from, color: t.id === "light" || t.id === "canvas" ? "#0b1215" : "#fff" }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {mode === "ai" && (
        <div className="flex flex-col gap-2">
          <Select value={model} options={imageModels} onChange={setModel} placeholder="이미지 모델" />
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="배경 프롬프트 (텍스트 없는 추상 배경 권장)"
            className="h-20 w-full resize-y rounded-md border border-border bg-surface p-2 text-base outline-none focus:border-primary"
          />
          <button
            onClick={generate}
            disabled={busy || !model || !prompt.trim()}
            className="self-start rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-primary-dark active:scale-[0.98] disabled:opacity-40"
          >
            {busy ? "생성 중…" : "배경 생성"}
          </button>
          {err && <p className="text-xs text-danger">{err}</p>}
        </div>
      )}

      {mode === "pick" && (
        <button
          onClick={() => setPickOpen(true)}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium transition-all duration-200 hover:border-empathy"
        >
          히스토리에서 이미지 선택
        </button>
      )}

      {preview && (
        <div className="mt-3">
          <div className="mb-1 text-xs text-muted">현재 배경</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="bg" className="h-40 w-[90px] rounded-md border border-border object-cover" />
        </div>
      )}

      <HistoryPicker
        open={pickOpen}
        modality="image"
        title="배경 이미지 선택"
        onClose={() => setPickOpen(false)}
        onPick={(ref: AssetRef) => {
          setPickOpen(false);
          onSetImage({ source: "pick", ref });
        }}
      />
    </div>
  );
}
