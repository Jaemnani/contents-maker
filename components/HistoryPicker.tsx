"use client";
// History picker: browse generated source assets with prompt/model filters. Enforces the
// same-prompt constraint via `samePromptAs` (only assets sharing that prompt are shown).
import { useEffect, useState } from "react";
import type { AssetRef, SourceType } from "@/lib/composition-types";
import { listSources, assetThumbUrl, assetUrl } from "@/lib/client/wizard";
import Select from "@/components/ui/Select";

export default function HistoryPicker({
  open,
  modality,
  samePromptAs,
  exclude,
  title = "히스토리에서 선택",
  onPick,
  onClose,
}: {
  open: boolean;
  modality: SourceType;
  samePromptAs?: string;
  exclude?: AssetRef;
  title?: string;
  onPick: (ref: AssetRef) => void;
  onClose: () => void;
}) {
  const [assets, setAssets] = useState<AssetRef[]>([]);
  const [prompts, setPrompts] = useState<{ prompt: string; count: number }[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [promptFilter, setPromptFilter] = useState<string>(samePromptAs ?? "");
  const [modelFilter, setModelFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setPromptFilter(samePromptAs ?? "");
  }, [open, samePromptAs]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listSources(modality, { samePromptAs: promptFilter || undefined, model: modelFilter || undefined })
      .then((d) => {
        setAssets(d.assets);
        setPrompts(d.prompts);
        setModels(d.models);
      })
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, [open, modality, promptFilter, modelFilter]);

  if (!open) return null;
  const isExcluded = (a: AssetRef) => exclude && a.datasetPath === exclude.datasetPath && a.file === exclude.file;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-[960px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-base font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-muted hover:bg-surface-muted">✕</button>
        </div>

        <div className="flex flex-wrap gap-3 border-b border-border px-5 py-3">
          <div className="min-w-[260px] flex-1">
            <label className="mb-1 block text-xs text-muted">프롬프트</label>
            <Select
              value={promptFilter}
              disabled={!!samePromptAs}
              placeholder="전체 프롬프트"
              options={[{ value: "", label: "전체 프롬프트" }, ...prompts.map((p) => ({ value: p.prompt, label: `${p.prompt.slice(0, 40)}${p.prompt.length > 40 ? "…" : ""} (${p.count})` }))]}
              onChange={setPromptFilter}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="mb-1 block text-xs text-muted">모델</label>
            <Select
              value={modelFilter}
              placeholder="전체 모델"
              options={[{ value: "", label: "전체 모델" }, ...models.map((m) => ({ value: m, label: m }))]}
              onChange={setModelFilter}
            />
          </div>
        </div>

        <div className="grow overflow-auto p-5">
          {samePromptAs && (
            <p className="mb-3 rounded-md bg-primary/10 p-2 text-xs text-primary">
              같은 프롬프트로 만든 소스만 표시됩니다.
            </p>
          )}
          {loading ? (
            <p className="text-sm text-muted">불러오는 중…</p>
          ) : assets.length === 0 ? (
            <p className="text-sm text-muted">조건에 맞는 소스가 없습니다. Source Studio에서 먼저 생성하세요.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {assets.map((a, i) => {
                const excluded = isExcluded(a);
                return (
                  <button
                    key={`${a.datasetPath}/${a.file}/${i}`}
                    disabled={excluded}
                    onClick={() => onPick(a)}
                    className={`group overflow-hidden rounded-lg border border-border bg-surface-muted text-left transition-all duration-200 hover:border-empathy hover:-translate-y-px ${excluded ? "opacity-30" : ""}`}
                  >
                    <div className="aspect-[9/16] w-full overflow-hidden bg-ink/5">
                      {a.thumb || modality === "image" ? (
                        // poster image (videos with a generated poster, or any image asset)
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={assetThumbUrl(a)} alt={a.label ?? a.file} className="h-full w-full object-cover" />
                      ) : (
                        <video src={assetUrl(a)} className="h-full w-full object-cover" muted preload="metadata" />
                      )}
                    </div>
                    <div className="px-2 py-1.5">
                      <div className="truncate text-xs font-medium text-ink">{a.label ?? a.modelUid}</div>
                      <div className="truncate text-[11px] text-muted">{a.prompt}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
