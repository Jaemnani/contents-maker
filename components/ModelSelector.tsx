"use client";
import type { Language, Modality, ModelEntry, SelectionMode, Tier } from "@/lib/types";
import { formatUSD } from "@/lib/pricing";

const MODE_LABELS: Record<SelectionMode, string> = {
  tier: "티어 랜덤",
  direct: "직접 선택",
  preset: "최저가(테스트)",
};

export default function ModelSelector({
  modality,
  models,
  tiers,
  tierLabels,
  presetIds,
  mode,
  onMode,
  tierCounts,
  onTierCounts,
  directIds,
  onDirect,
  estOne,
  language,
}: {
  modality: Modality;
  models: ModelEntry[];
  tiers: Tier[];
  tierLabels: Record<Tier, string>;
  presetIds: string[];
  mode: SelectionMode;
  onMode: (m: SelectionMode) => void;
  tierCounts: Record<string, number>;
  onTierCounts: (next: Record<string, number>) => void;
  directIds: string[];
  onDirect: (ids: string[]) => void;
  estOne: (m: ModelEntry) => number | null;
  language: Language;
}) {
  const byTier = (t: Tier) => models.filter((m) => m.tier === t);
  const presentTiers = tiers.filter((t) => byTier(t).length > 0);
  const jaWarn = (m: ModelEntry) =>
    language === "ja" && modality !== "text" && m.jaTextQuality !== "good";

  const toggleDirect = (id: string) =>
    onDirect(directIds.includes(id) ? directIds.filter((x) => x !== id) : [...directIds, id]);

  return (
    <div>
      <div className="mb-2 flex gap-1">
        {(Object.keys(MODE_LABELS) as SelectionMode[]).map((m) => (
          <button
            key={m}
            onClick={() => onMode(m)}
            className={`rounded px-2.5 py-1 text-xs font-medium ${
              mode === m ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {mode === "tier" && (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-400">티어별 개수를 정하면 매 생성 시 해당 티어에서 랜덤 선택됩니다.</p>
          {presentTiers.map((t) => {
            const pool = byTier(t);
            const count = tierCounts[t] ?? 0;
            return (
              <div key={t} className="flex items-center justify-between rounded border border-gray-100 px-2 py-1.5">
                <span className="text-sm text-gray-700">
                  {tierLabels[t]} <span className="text-xs text-gray-400">({pool.length}개)</span>
                  {t === "free" && <span className="ml-1 text-xs text-amber-600">불안정</span>}
                </span>
                <input
                  type="number"
                  min={0}
                  max={pool.length}
                  value={count}
                  onChange={(e) =>
                    onTierCounts({ ...tierCounts, [t]: Math.max(0, Math.min(pool.length, Number(e.target.value) || 0)) })
                  }
                  className="w-16 rounded border border-gray-200 px-2 py-0.5 text-sm"
                />
              </div>
            );
          })}
        </div>
      )}

      {mode === "direct" && (
        <div className="max-h-72 space-y-2 overflow-auto pr-1">
          {presentTiers.map((t) => (
            <div key={t}>
              <div className="mb-1 text-xs font-semibold text-gray-500">
                {tierLabels[t]}
                {t === "free" && (
                  <span className="ml-1 font-normal text-amber-600">· provider 측 불안정(Out of credits) 가능</span>
                )}
              </div>
              <div className="space-y-1">
                {byTier(t).map((m) => {
                  const est = estOne(m);
                  return (
                    <label key={m.uid} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={directIds.includes(m.uid)}
                        onChange={() => toggleDirect(m.uid)}
                      />
                      <span className="flex-1 truncate text-sm text-gray-700">{m.label}</span>
                      {jaWarn(m) && (
                        <span className="rounded bg-amber-100 px-1 text-[10px] text-amber-700" title="일본어 문자 렌더 품질 불확실">
                          JA?
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{formatUSD(est)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === "preset" && (
        <div className="rounded border border-gray-100 p-2">
          <p className="mb-1 text-xs text-gray-400">최저가 {presetIds.length}종 (테스트용) 자동 선택</p>
          <ul className="space-y-0.5">
            {presetIds.map((id) => {
              const m = models.find((x) => x.uid === id);
              return (
                <li key={id} className="flex justify-between text-sm text-gray-700">
                  <span className="truncate">{m?.label ?? id}</span>
                  <span className="text-xs text-gray-400">{m ? formatUSD(estOne(m)) : ""}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
