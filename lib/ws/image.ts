// WaveSpeed image generation. Async predict+poll, but we block server-side so the
// client image flow stays synchronous (WS image completes in ~10-20s).
import "server-only";
import { wsSubmit, wsPoll } from "@/lib/ws/predict";
import { WS_DEFS_BY_ID, wsImageSize } from "@/lib/ws/models";
import { IMAGE_OVERLAY_GUIDANCE, LANGUAGE_NAMES } from "@/lib/channels";
import type { ImageResolution, Language } from "@/lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface WsImageResult {
  urls: string[];
  cost: number | null;
}

export async function generateWsImage(opts: {
  model: string;
  prompt: string;
  aspect: string;
  language: Language;
  enhance: boolean;
  resolution?: ImageResolution;
  signal?: AbortSignal;
}): Promise<WsImageResult> {
  const def = WS_DEFS_BY_ID[opts.model];
  if (!def) throw new Error(`Unknown WS model: ${opts.model}`);
  const prompt = opts.enhance
    ? `${opts.prompt}\n${IMAGE_OVERLAY_GUIDANCE}\nAny text in the image should be in ${LANGUAGE_NAMES[opts.language]}.`
    : opts.prompt;

  // Google nano-banana models need aspect_ratio (they ignore the "W*H" size param); others take size.
  const input: Record<string, unknown> = def.aspectMode === "aspect_ratio"
    ? { prompt, aspect_ratio: opts.aspect }
    : { prompt, size: wsImageSize(opts.aspect, opts.resolution ?? "1k", def.imageMaxDim) };
  const { pollUrl } = await wsSubmit(opts.model, input, opts.signal);

  for (let i = 0; i < 45; i++) {
    await sleep(2000);
    const r = await wsPoll(pollUrl, opts.signal);
    if (r.status === "completed") return { urls: r.outputs ?? [], cost: def.imageUnitUsd ?? null };
    if (r.status === "failed") throw new Error(r.error || "WaveSpeed image generation failed");
  }
  throw new Error("WaveSpeed image timed out");
}
