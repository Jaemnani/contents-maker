"use client";
// Page source chooser: AI generate (image) | upload | pick from the shared pool.
import { useState } from "react";
import type { AdPage, AdProject, PageSource } from "@/lib/ad/schema";
import { slotSource, slotPrompt, SLOT_SOURCE_FIELD, type SlotKey } from "@/lib/ad/schema";
import type { AssetRef } from "@/lib/composition-types";
import Select, { type SelectOption } from "@/components/ui/Select";
import HistoryPicker from "@/components/HistoryPicker";
import { uploadFile, fileUrl, assetThumbUrl } from "@/lib/client/wizard";

async function generatePageImage(args: { projectId: string; pageId: string; model: string; prompt: string; slot?: SlotKey }): Promise<AdProject> {
  const res = await fetch("/api/ad/page-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d?.error) throw new Error(d?.error?.message || `HTTP ${res.status}`);
  return d.project;
}

function SourceThumb({ source }: { source: PageSource }) {
  if (source.kind === "none")
    return <div className="grid h-24 w-16 shrink-0 place-items-center rounded-md bg-ink/10 text-[10px] text-muted">없음</div>;
  const url = source.kind === "asset" ? assetThumbUrl(source.ref) : fileUrl(source.path);
  const isVideo = source.kind === "asset" ? source.ref.modality === "video" : /\.(mp4|webm|mov)$/i.test(source.path);
  return isVideo && source.kind === "upload" ? (
    <video src={url} muted preload="metadata" className="h-24 w-16 shrink-0 rounded-md object-cover" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-24 w-16 shrink-0 rounded-md object-cover" />
  );
}

export default function SourceChooser({
  project,
  page,
  imageModels,
  onPatch,
  onProject,
  onFlush,
  slot = "A",
}: {
  project: AdProject;
  page: AdPage;
  imageModels: SelectOption[];
  onPatch: (patch: Partial<AdPage>) => void;
  onProject: (p: AdProject) => void;
  onFlush?: () => Promise<void>;
  slot?: SlotKey; // which media slot (A/B/C/D) this chooser edits
}) {
  const source: PageSource = slotSource(page, slot);
  const patchSource = (s: PageSource) => onPatch({ [SLOT_SOURCE_FIELD[slot]]: s } as Partial<AdPage>);

  const [tab, setTab] = useState<"ai" | "upload" | "pool">(page.sourceType === "video" ? "pool" : "ai");
  const [modelPick, setModelPick] = useState("");
  // models load async after mount — fall back to the first option until the user picks
  const model = modelPick || imageModels[0]?.value || "";
  const [prompt, setPrompt] = useState(slotPrompt(page, slot) ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pickOpen, setPickOpen] = useState(false);

  const canAi = page.sourceType === "image";
  // sourceType can flip while mounted (image→video) — never leave an invalid tab active
  const effTab = tab === "ai" && !canAi ? "pool" : tab;

  async function genAi() {
    if (!prompt.trim() || !model) return;
    setBusy(true);
    setErr("");
    try {
      await onFlush?.(); // persist in-flight edits before the server read-modify-write
      onProject(await generatePageImage({ projectId: project.projectId, pageId: page.id, model, prompt, slot }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const path = await uploadFile(file, project.projectId);
      patchSource({ kind: "upload", path });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-3">
      <SourceThumb source={source} />
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex gap-1">
          {canAi && (
            <button onClick={() => setTab("ai")} className={`rounded-md px-2.5 py-1 text-xs ${effTab === "ai" ? "bg-primary text-white" : "text-muted hover:bg-surface-muted"}`}>AI 생성</button>
          )}
          <button onClick={() => setTab("upload")} className={`rounded-md px-2.5 py-1 text-xs ${effTab === "upload" ? "bg-primary text-white" : "text-muted hover:bg-surface-muted"}`}>업로드</button>
          <button onClick={() => setTab("pool")} className={`rounded-md px-2.5 py-1 text-xs ${effTab === "pool" ? "bg-primary text-white" : "text-muted hover:bg-surface-muted"}`}>소스 풀</button>
        </div>

        {effTab === "ai" && canAi && (
          <div className="flex flex-col gap-2">
            <Select value={model} options={imageModels} onChange={setModelPick} placeholder="이미지 모델" />
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="이미지 생성 프롬프트 (영문 권장)"
              className="h-16 w-full resize-y rounded-md border border-border bg-surface p-2 text-base outline-none focus:border-primary"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={genAi} disabled={busy || !prompt.trim() || !model} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-all duration-200 hover:bg-primary-dark active:scale-[0.98] disabled:opacity-40">
                {busy ? "생성 중…" : "이미지 생성"}
              </button>
              {project.meta.seedPrompt && project.meta.seedPrompt !== prompt && (
                <button
                  onClick={() => setPrompt(project.meta.seedPrompt!)}
                  title={project.meta.seedPrompt}
                  className="rounded-md border border-empathy/50 px-2.5 py-1.5 text-xs font-medium text-empathy transition-all duration-200 hover:bg-empathy/10"
                >
                  ✨ 추천 프롬프트 넣기
                </button>
              )}
            </div>
          </div>
        )}

        {effTab === "upload" && (
          <label className="block cursor-pointer rounded-md border border-dashed border-border p-3 text-center text-xs text-muted transition-all duration-200 hover:border-empathy">
            {busy ? "업로드 중…" : `${page.sourceType === "image" ? "이미지" : "영상"} 파일 선택/드롭`}
            <input
              type="file"
              accept={page.sourceType === "image" ? "image/*" : "video/*"}
              className="hidden"
              onChange={(e) => onUpload(e.target.files?.[0])}
            />
          </label>
        )}

        {effTab === "pool" && (
          <button onClick={() => setPickOpen(true)} className="rounded-md border border-border px-3 py-1.5 text-xs text-ink transition-all duration-200 hover:border-empathy">
            소스 풀에서 선택…
          </button>
        )}

        {err && <p className="mt-1.5 text-xs text-danger">{err}</p>}
      </div>

      <HistoryPicker
        open={pickOpen}
        modality={page.sourceType}
        title={`${page.sourceType === "image" ? "이미지" : "클립"} 선택`}
        onClose={() => setPickOpen(false)}
        onPick={(ref: AssetRef) => {
          patchSource({ kind: "asset", ref });
          setPickOpen(false);
        }}
      />
    </div>
  );
}
