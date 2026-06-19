// Shared server helper: generate image source(s) for one prompt + N models, persist as a
// single source folder (same-prompt set), and return AssetRefs. Per-model failures are
// isolated (one bad model doesn't abort the rest). Server-only.
import "server-only";
import { generateImageRaw } from "@/lib/post/image-gen";
import { saveSourceBatch } from "@/lib/storage";
import { MODELS_BY_ID } from "@/lib/models";
import type { GenResult, Language } from "@/lib/types";
import type { AssetRef } from "@/lib/composition-types";

export interface GenImageSourcesOpts {
  language: Language;
  prompt: string;
  models: string[]; // image-model uids
  aspect?: string; // default 9:16
}

export interface GenImageSourcesResult {
  datasetPath: string;
  refs: AssetRef[]; // successful models only, in request order
  errors: { model: string; error: string }[];
}

export async function generateImageSources(opts: GenImageSourcesOpts): Promise<GenImageSourcesResult> {
  const aspect = opts.aspect ?? "9:16";
  // Generate all models in parallel (order preserved), isolating per-model failures.
  const results: GenResult[] = await Promise.all(
    opts.models.map(async (uid): Promise<GenResult> => {
      try {
        const r = await generateImageRaw({ uid, prompt: opts.prompt, language: opts.language, aspect });
        return { model: uid, status: "done", ms: r.ms, actualCost: r.cost, images: [{ aspect, dataUrl: r.dataUrl }] };
      } catch (e) {
        return { model: uid, status: "error", error: (e as Error).message };
      }
    })
  );
  const errors = results
    .filter((r) => r.status === "error")
    .map((r) => ({ model: r.model, error: r.error ?? "생성 실패" }));
  const saved = await saveSourceBatch({ type: "image", language: opts.language, prompt: opts.prompt, results });
  const refFor = (uid: string): AssetRef | null => {
    const f = saved.entry.files.find((x) => x.model === uid);
    if (!f) return null;
    return {
      datasetPath: saved.entry.path,
      file: f.file,
      modality: "image",
      modelUid: uid,
      aspect: f.aspect,
      label: MODELS_BY_ID[uid]?.label ?? uid,
      prompt: opts.prompt,
      thumb: f.thumb,
    };
  };
  const refs = opts.models.map(refFor).filter((r): r is AssetRef => r != null);
  return { datasetPath: saved.entry.path, refs, errors };
}
