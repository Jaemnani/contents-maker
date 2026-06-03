// Client-side image generation: fan-out per model × aspect (p-limit), collect images per model.
import pLimit from "p-limit";
import type { GenResult, ImageResolution, Language } from "@/lib/types";

const IMAGE_CONCURRENCY = 3;

export interface RunImageOpts {
  models: string[];
  aspects: string[];
  prompt: string;
  language: Language;
  enhance: boolean;
  resolution: ImageResolution;
  onUpdate: (model: string, patch: Partial<GenResult>) => void;
  signal?: AbortSignal;
}

export async function runImageGeneration(opts: RunImageOpts): Promise<void> {
  const limit = pLimit(IMAGE_CONCURRENCY);
  // accumulate per-model images/cost across its aspect calls
  const acc: Record<string, { images: { aspect: string; dataUrl: string }[]; cost: number; ms: number; errors: string[] }> = {};
  for (const m of opts.models) acc[m] = { images: [], cost: 0, ms: 0, errors: [] };

  const tasks: Promise<void>[] = [];
  for (const model of opts.models) {
    opts.onUpdate(model, { status: "loading" });
    for (const aspect of opts.aspects) {
      tasks.push(
        limit(async () => {
          try {
            const res = await fetch("/api/image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ model, prompt: opts.prompt, language: opts.language, aspect, resolution: opts.resolution, enhance: opts.enhance }),
              signal: opts.signal,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
            const a = acc[model];
            for (const url of data.images ?? []) a.images.push({ aspect, dataUrl: url });
            if (typeof data.cost === "number") a.cost += data.cost;
            a.ms = Math.max(a.ms, data.ms ?? 0);
            opts.onUpdate(model, {
              status: "streaming",
              images: [...a.images],
              actualCost: a.cost || null,
            });
          } catch (e) {
            acc[model].errors.push((e as Error).message);
          }
        })
      );
    }
  }
  await Promise.allSettled(tasks);

  for (const model of opts.models) {
    const a = acc[model];
    if (a.images.length) {
      opts.onUpdate(model, { status: "done", images: a.images, actualCost: a.cost || null, ms: a.ms });
    } else {
      opts.onUpdate(model, { status: "error", error: a.errors[0] ?? "이미지 없음" });
    }
  }
}
