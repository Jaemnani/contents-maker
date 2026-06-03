// fal.ai image generation (sync). Returns public CDN image URLs (not base64).
import "server-only";
import { FAL_SYNC, falHeaders, falToError } from "@/lib/fal/client";
import { FAL_DEFS_BY_ID, falImageSize } from "@/lib/fal/models";
import { IMAGE_OVERLAY_GUIDANCE, LANGUAGE_NAMES } from "@/lib/channels";
import type { ImageResolution, Language } from "@/lib/types";

export interface FalImageResult {
  urls: string[];
  cost: number | null;
}

export async function generateFalImage(opts: {
  model: string;
  prompt: string;
  aspect: string;
  language: Language;
  enhance: boolean;
  resolution?: ImageResolution;
  signal?: AbortSignal;
}): Promise<FalImageResult> {
  const def = FAL_DEFS_BY_ID[opts.model];
  if (!def) throw new Error(`Unknown fal model: ${opts.model}`);

  const prompt = opts.enhance
    ? `${opts.prompt}\n${IMAGE_OVERLAY_GUIDANCE}\nAny text in the image should be in ${LANGUAGE_NAMES[opts.language]}.`
    : opts.prompt;

  const input: Record<string, unknown> = { prompt, num_images: 1 };
  if (def.aspectMode === "aspect_ratio") {
    input.aspect_ratio = opts.aspect; // provider default size; pixel size not controllable here
  } else {
    input.image_size = falImageSize(opts.aspect, opts.resolution ?? "1k", def.imageMaxDim);
  }

  const res = await fetch(`${FAL_SYNC}/${opts.model}`, {
    method: "POST",
    headers: falHeaders(),
    signal: opts.signal,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await falToError(res);
  const json = (await res.json()) as { images?: { url?: string }[] };
  const urls = (json.images ?? [])
    .map((im) => im.url)
    .filter((u): u is string => typeof u === "string");
  // fal doesn't return per-call cost; use the curated per-image price.
  return { urls, cost: def.imageUnitUsd ?? null };
}
