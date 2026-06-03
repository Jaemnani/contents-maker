// Model selection resolver (user request: "매일 다른 AI").
// Three modes: tier (random sample from tier pool), direct (explicit), preset (cheapest).
import type { Modality, Tier } from "@/lib/types";
import { modelsByTier, CHEAPEST_PRESETS } from "@/lib/models";

// Models (by uid) excluded from random tier sampling (still usable via direct selection).
// e.g. ZDR-only video providers that require an output.upload_url we don't supply.
const RANDOM_EXCLUDE = new Set<string>(["openrouter:x-ai/grok-imagine-video"]);

export interface TierPick {
  tier: Tier;
  count: number; // how many distinct models to randomly sample from this tier
}

function sample<T>(arr: T[], n: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/**
 * Resolve the concrete model ids to call for one generation run.
 * - tier mode: for each TierPick, randomly sample `count` distinct models from that tier.
 * - direct mode: `directIds` used as-is.
 * - preset mode: cheapest preset for the modality.
 * Re-runs in tier mode produce different models (the "different AI each time" behavior).
 */
export function resolveModels(
  modality: Modality,
  opts: { mode: "tier" | "direct" | "preset"; tierPicks?: TierPick[]; directIds?: string[] }
): string[] {
  if (opts.mode === "preset") return CHEAPEST_PRESETS[modality] ?? [];
  if (opts.mode === "direct") return opts.directIds ?? [];
  // tier
  const ids: string[] = [];
  for (const pick of opts.tierPicks ?? []) {
    const pool = modelsByTier(modality, pick.tier)
      .map((m) => m.uid)
      .filter((uid) => !RANDOM_EXCLUDE.has(uid));
    ids.push(...sample(pool, Math.min(pick.count, pool.length)));
  }
  return ids;
}
