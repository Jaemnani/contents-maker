"use client";
// Main(body) editor: fill A/B (generate a same-prompt pair OR pick from history with the
// same-prompt constraint), choose layout + motion/panel/videoFit options, labels, background.
import { useState } from "react";
import type { Composition, Stage, AssetRef, MainLayout, StageImage } from "@/lib/composition-types";
import { MAIN_LAYOUT_LABELS } from "@/lib/composition-types";
import { comparePair, assetUrl, assetThumbUrl } from "@/lib/client/wizard";
import Select, { type SelectOption } from "@/components/ui/Select";
import HistoryPicker from "@/components/HistoryPicker";
import StageImageChooser from "@/components/wizard/StageImageChooser";
import TextStyleControls from "@/components/wizard/TextStyleControls";

const MOTION_OPTS: SelectOption[] = [
  { value: "kenburns-vs", label: "VS + 켄번즈 (기본)" },
  { value: "spotlight-vs", label: "VS + 스포트라이트" },
  { value: "slide-reveal", label: "슬라이드 공개 (비율 이동)" },
  { value: "divider-only", label: "분할선만" },
  { value: "none", label: "정적" },
];
const REVEAL_RATIOS = [
  { v: 0.8, l: "8:2" },
  { v: 0.7, l: "7:3" },
  { v: 0.6, l: "6:4" },
  { v: 0.5, l: "5:5" },
];
const PANEL_OPTS: SelectOption[] = [
  { value: "rounded-shadow", label: "둥근+그림자" },
  { value: "square-border", label: "직각+테두리" },
  { value: "rounded-flat", label: "둥근(평면)" },
];
const FIT_OPTS: SelectOption[] = [
  { value: "loop", label: "긴쪽 맞춤+짧은쪽 루프" },
  { value: "trim", label: "짧은쪽 맞춤+긴쪽 자름" },
  { value: "freeze", label: "각자 원본, 먼저 끝난쪽 정지" },
  { value: "sequential", label: "순차 재생" },
];

function SidePreview({ ref_, label }: { ref_?: AssetRef; label?: string }) {
  if (!ref_) return <div className="flex h-40 w-[90px] items-center justify-center rounded-md border border-dashed border-border text-xs text-muted">비어있음</div>;
  const showImg = ref_.thumb || ref_.modality === "image";
  return (
    <div>
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={assetThumbUrl(ref_)} alt={label} className="h-40 w-[90px] rounded-md border border-border object-cover" />
      ) : (
        <video src={assetUrl(ref_)} className="h-40 w-[90px] rounded-md border border-border object-cover" muted preload="metadata" />
      )}
      <div className="mt-1 w-[90px] truncate text-[11px] text-muted">{label ?? ref_.label}</div>
    </div>
  );
}

export default function MainStage({
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
  const sourceType = comp.sourceType;
  const [tab, setTab] = useState<"generate" | "pick">("generate");
  const [modelA, setModelA] = useState(imageModels[0]?.value ?? "");
  const [modelB, setModelB] = useState(imageModels[1]?.value ?? "");
  const [prompt, setPrompt] = useState(comp.comparePrompt ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pick, setPick] = useState<null | "a" | "b">(null);

  const canGenerate = sourceType === "image"; // on-the-spot pair gen supported for images in v1

  async function genPair() {
    if (modelA === modelB) {
      setErr("서로 다른 두 모델을 선택하세요.");
      return;
    }
    if (!prompt.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const { composition } = await comparePair({ compId: comp.compId, prompt, language: comp.primaryLanguage, modelA, modelB });
      onComp(composition);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const layout = stage.layout ?? "split";

  return (
    <div className="flex flex-col gap-5">
      {/* fill A/B */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-sm font-bold">비교 소스 (A 위 / B 아래)</h3>
          <div className="ml-auto flex gap-1">
            <button onClick={() => setTab("generate")} className={`rounded-md px-3 py-1 text-sm ${tab === "generate" ? "bg-primary text-white" : "text-muted hover:bg-surface-muted"}`}>쌍 생성</button>
            <button onClick={() => setTab("pick")} className={`rounded-md px-3 py-1 text-sm ${tab === "pick" ? "bg-primary text-white" : "text-muted hover:bg-surface-muted"}`}>히스토리</button>
          </div>
        </div>

        {tab === "generate" && (
          canGenerate ? (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <div className="flex-1"><label className="mb-1 block text-xs text-muted">모델 A (위)</label><Select value={modelA} options={imageModels} onChange={setModelA} /></div>
                <div className="flex-1"><label className="mb-1 block text-xs text-muted">모델 B (아래)</label><Select value={modelB} options={imageModels} onChange={setModelB} /></div>
              </div>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="한 프롬프트로 두 모델 생성…" className="h-20 w-full resize-y rounded-md border border-border bg-surface p-2 text-base outline-none focus:border-primary" />
              <button onClick={genPair} disabled={busy || !prompt.trim()} className="self-start rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-primary-dark active:scale-[0.98] disabled:opacity-40">
                {busy ? "생성 중…" : "쌍 생성 (같은 프롬프트)"}
              </button>
              {err && <p className="text-xs text-danger">{err}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted">영상 비교는 Source Studio에서 미리 생성한 뒤 ‘히스토리’에서 선택하세요.</p>
          )
        )}

        {tab === "pick" && (
          <div className="flex gap-2">
            <button onClick={() => setPick("a")} className="rounded-md border border-border px-4 py-2 text-sm hover:border-empathy">A 선택</button>
            <button onClick={() => setPick("b")} disabled={!stage.aRef} className="rounded-md border border-border px-4 py-2 text-sm hover:border-empathy disabled:opacity-40">
              B 선택{!stage.aRef && " (먼저 A)"}
            </button>
          </div>
        )}

        <div className="mt-4 flex gap-6">
          <SidePreview ref_={stage.aRef} label={stage.aLabel} />
          <div className="self-center text-sm font-bold text-primary">VS</div>
          <SidePreview ref_={stage.bRef} label={stage.bLabel} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={stage.showLabels ?? true} onChange={(e) => onPatch({ showLabels: e.target.checked })} className="accent-primary" />
            모델명 라벨 표시
          </label>
          {(stage.showLabels ?? true) && (
            <div className="flex items-center gap-1 text-xs text-muted">
              위치
              {([
                { v: "tl", l: "좌상단" },
                { v: "tr", l: "우상단" },
                { v: "center", l: "중앙" },
              ] as const).map((o) => (
                <button
                  key={o.v}
                  onClick={() => onPatch({ labelPos: o.v })}
                  className={`rounded-md px-2 py-1 transition-colors duration-200 ${(stage.labelPos ?? "tl") === o.v ? "bg-primary text-white" : "hover:bg-surface-muted"}`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          )}
          {stage.aRef && (
            <input value={stage.aLabel ?? ""} onChange={(e) => onPatch({ aLabel: e.target.value })} placeholder="A 라벨" className="w-40 rounded-md border border-border bg-surface px-2 py-1 text-sm" />
          )}
          {stage.bRef && (
            <input value={stage.bLabel ?? ""} onChange={(e) => onPatch({ bLabel: e.target.value })} placeholder="B 라벨" className="w-40 rounded-md border border-border bg-surface px-2 py-1 text-sm" />
          )}
        </div>

        {(stage.showLabels ?? true) && (
          <div className="mt-2">
            <div className="mb-1 text-xs text-muted">라벨 스타일</div>
            <TextStyleControls value={stage.labelStyle} defaultSize={40} onChange={(s) => onPatch({ labelStyle: s })} />
          </div>
        )}
      </section>

      {/* layout + options */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h3 className="mb-3 text-sm font-bold">레이아웃 & 연출</h3>
        <div className="mb-3 flex flex-wrap gap-2">
          {(Object.keys(MAIN_LAYOUT_LABELS) as MainLayout[]).map((l) => (
            <button
              key={l}
              onClick={() => onPatch({ layout: l })}
              className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all duration-200 hover:-translate-y-px ${layout === l ? "border-empathy ring-2 ring-empathy/30" : "border-border"}`}
            >
              {MAIN_LAYOUT_LABELS[l]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs text-muted">연출</label>
            <Select
              value={stage.motionStyle ?? "kenburns-vs"}
              options={MOTION_OPTS}
              onChange={(v) =>
                onPatch({
                  motionStyle: v as Stage["motionStyle"],
                  // slide-reveal is a split-layout effect — switch layout to keep it visible.
                  ...(v === "slide-reveal" && layout !== "split" ? { layout: "split" as const } : {}),
                })
              }
            />
          </div>
          {stage.motionStyle === "slide-reveal" && (
            <>
              <div>
                <label className="mb-1 block text-xs text-muted">방향</label>
                <div className="flex gap-1">
                  {([{ v: "v", l: "상하" }, { v: "h", l: "좌우" }] as const).map((d) => (
                    <button
                      key={d.v}
                      onClick={() => onPatch({ revealDir: d.v })}
                      className={`rounded-md px-3 py-2 text-sm transition-colors duration-200 ${(stage.revealDir ?? "v") === d.v ? "bg-primary text-white" : "border border-border text-muted hover:border-empathy"}`}
                    >
                      {d.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">시작 비율 (A:B → 반전)</label>
                <div className="flex gap-1">
                  {REVEAL_RATIOS.map((r) => (
                    <button
                      key={r.v}
                      onClick={() => onPatch({ revealRatio: r.v })}
                      className={`rounded-md px-2 py-2 text-sm transition-colors duration-200 ${(stage.revealRatio ?? 0.8) === r.v ? "bg-primary text-white" : "border border-border text-muted hover:border-empathy"}`}
                    >
                      {r.l}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-end gap-2 pb-2 text-sm text-muted">
                <input type="checkbox" checked={stage.showDivider ?? false} onChange={(e) => onPatch({ showDivider: e.target.checked })} className="accent-primary" />
                경계선 표시
              </label>
            </>
          )}
          {layout === "panels" && (
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-xs text-muted">패널 스타일</label>
              <Select value={stage.panelStyle ?? "rounded-shadow"} options={PANEL_OPTS} onChange={(v) => onPatch({ panelStyle: v as Stage["panelStyle"] })} />
            </div>
          )}
          {sourceType === "video" ? (
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-xs text-muted">영상 길이 처리</label>
              <Select value={stage.videoFit ?? "loop"} options={FIT_OPTS} onChange={(v) => onPatch({ videoFit: v as Stage["videoFit"] })} />
            </div>
          ) : (
            <div className="w-32">
              <label className="mb-1 block text-xs text-muted">본론 길이(초)</label>
              <input type="number" min={2} max={30} value={stage.bodyDurationSec ?? 6} onChange={(e) => onPatch({ bodyDurationSec: Number(e.target.value) || 6 })} className="w-full rounded-md border border-border bg-surface px-2 py-2 text-base" />
            </div>
          )}
        </div>

        {layout === "panels" && (
          <div className="mt-3">
            <label className="mb-1 block text-xs text-muted">배경 (레이아웃 B)</label>
            <StageImageChooser
              comp={comp}
              stageId="main"
              image={stage.image}
              imageModels={imageModels}
              onSetImage={(img: StageImage) => onPatch({ image: img })}
              onComp={onComp}
            />
          </div>
        )}
      </section>

      <HistoryPicker
        open={pick !== null}
        modality={sourceType}
        samePromptAs={pick === "b" ? stage.aRef?.prompt : undefined}
        exclude={pick === "b" ? stage.aRef : undefined}
        title={pick === "a" ? "A 소스 선택" : "B 소스 선택 (같은 프롬프트)"}
        onClose={() => setPick(null)}
        onPick={(ref: AssetRef) => {
          if (pick === "a") onPatch({ aRef: ref, aLabel: ref.label });
          else onPatch({ bRef: ref, bLabel: ref.label });
          setPick(null);
        }}
      />
    </div>
  );
}
