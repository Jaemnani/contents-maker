// Client-side cost estimation for the current selection.
// Tier mode is random, so we report a min–max range over the tier pool.
import type { Language, Modality, ModelEntry, VideoParams } from "@/lib/types";
import { estimateText, estimateImage, estimateVideo } from "@/lib/pricing";
import type { TierPick } from "@/lib/selection";

export interface EstimateContext {
  prompt: string;
  language: Language;
  maxTokens: number;
  aspectCount: number;
  videoParams: VideoParams;
}

export interface SelectionEstimate {
  min: number;
  max: number;
  exact: boolean; // direct/preset => true
  unknownCount: number; // models whose price couldn't be computed
}

export function estimateOne(model: ModelEntry, modality: Modality, ctx: EstimateContext): number | null {
  if (modality === "text") return estimateText(model, ctx.prompt, ctx.maxTokens, ctx.language).usd;
  if (modality === "image") return estimateImage(model, ctx.aspectCount).usd;
  return estimateVideo(model, ctx.videoParams).usd;
}

export function estimateExact(
  ids: string[],
  modality: Modality,
  byId: Record<string, ModelEntry>,
  ctx: EstimateContext
): SelectionEstimate {
  let sum = 0;
  let unknown = 0;
  for (const id of ids) {
    const m = byId[id];
    const e = m ? estimateOne(m, modality, ctx) : null;
    if (e === null) unknown++;
    else sum += e;
  }
  return { min: sum, max: sum, exact: true, unknownCount: unknown };
}

export function estimateTier(
  picks: TierPick[],
  modality: Modality,
  pools: (tier: string) => ModelEntry[],
  ctx: EstimateContext
): SelectionEstimate {
  let min = 0;
  let max = 0;
  let unknown = 0;
  for (const pick of picks) {
    if (pick.count <= 0) continue;
    const ests = pools(pick.tier)
      .map((m) => estimateOne(m, modality, ctx))
      .filter((e): e is number => e !== null)
      .sort((a, b) => a - b);
    const n = Math.min(pick.count, ests.length);
    if (ests.length < pick.count) unknown += pick.count - ests.length;
    min += ests.slice(0, n).reduce((s, x) => s + x, 0);
    max += ests.slice(ests.length - n).reduce((s, x) => s + x, 0);
  }
  return { min, max, exact: false, unknownCount: unknown };
}
