// Flatten the global source index into AssetRefs for the history picker.
// Supports the same-prompt constraint (samePromptAs) and prompt/model/aspect filters.
import "server-only";
import { readGlobalIndex } from "@/lib/storage";
import { MODELS_BY_ID } from "@/lib/models";
import type { AssetRef, SourceType } from "@/lib/composition-types";

export interface AssetFilter {
  samePromptAs?: string; // exact-prompt match (same-prompt constraint)
  model?: string; // model uid
  aspect?: string; // image only
  q?: string; // prompt substring search
  since?: string; // ISO date lower bound
}

export async function listAssets(modality: SourceType, filter: AssetFilter = {}): Promise<AssetRef[]> {
  const index = await readGlobalIndex();
  const out: AssetRef[] = [];
  for (const entry of index) {
    if (entry.type !== modality) continue;
    if (filter.samePromptAs != null && entry.prompt !== filter.samePromptAs) continue;
    if (filter.q && !entry.prompt.toLowerCase().includes(filter.q.toLowerCase())) continue;
    if (filter.since && entry.createdAt < filter.since) continue;
    for (const f of entry.files) {
      if (filter.model && f.model !== filter.model) continue;
      if (modality === "image" && filter.aspect && f.aspect && f.aspect !== filter.aspect) continue;
      out.push({
        datasetPath: entry.path,
        file: f.file,
        modality,
        modelUid: f.model,
        aspect: f.aspect,
        label: MODELS_BY_ID[f.model]?.label ?? f.model,
        prompt: entry.prompt,
        thumb: f.thumb ?? f.file,
      });
    }
  }
  return out; // newest-first (global index order)
}

/** Distinct prompts available for a modality (filter dropdown). */
export async function listPrompts(modality: SourceType): Promise<{ prompt: string; count: number }[]> {
  const index = await readGlobalIndex();
  const map = new Map<string, number>();
  for (const e of index) {
    if (e.type !== modality) continue;
    map.set(e.prompt, (map.get(e.prompt) ?? 0) + e.files.length);
  }
  return [...map.entries()].map(([prompt, count]) => ({ prompt, count }));
}

/** Distinct model uids present for a modality (filter dropdown). */
export async function listModels(modality: SourceType): Promise<string[]> {
  const index = await readGlobalIndex();
  const set = new Set<string>();
  for (const e of index) {
    if (e.type !== modality) continue;
    for (const f of e.files) set.add(f.model);
  }
  return [...set];
}
