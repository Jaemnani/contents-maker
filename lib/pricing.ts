// Cost estimation (USD). Pricing comes from the registry / live /api/models hydration.
import type { ModelEntry, Language, VideoParams } from "@/lib/types";
import { estimateTokens } from "@/lib/tokens";

export interface CostEstimate {
  usd: number | null; // null => unknown (e.g. token-priced video, missing price)
  note?: string; // human note (e.g. "토큰제 — 실측 필요")
}

const num = (x: unknown): number | null =>
  typeof x === "number" && !Number.isNaN(x) ? x : null;

/** Text: in tokens * prompt price + maxTokens * completion price. */
export function estimateText(
  model: ModelEntry,
  prompt: string,
  maxTokens: number,
  language: Language
): CostEstimate {
  const p = num(model.pricing?.prompt);
  const c = num(model.pricing?.completion);
  if (p === null || c === null) return { usd: null, note: "단가 미상" };
  const inTok = estimateTokens(prompt, language);
  return { usd: inTok * p + maxTokens * c };
}

/** Image: curated approx per-image USD (the API doesn't expose the real image-output rate). */
export function estimateImage(model: ModelEntry, aspectCount: number): CostEstimate {
  const unit = num(model.pricing?.imageUnitUsd);
  if (unit !== null) return { usd: unit * aspectCount, note: "근사(실측은 생성 후)" };
  return { usd: null, note: "실측 후 표시" };
}

const RES_ORDER = ["1080p", "720p", "480p"];

/** Pick per-second USD for a resolution from a video SKU map (no-audio preferred). */
export function videoPerSecond(
  skus: Record<string, string> | null | undefined,
  resolution: string
): number | null {
  if (!skus) return null;
  const keys = [
    `text_to_video_duration_seconds_${resolution}`,
    `duration_seconds_without_audio_${resolution}`,
    `duration_seconds_${resolution}`,
    "duration_seconds_without_audio",
    "duration_seconds",
  ];
  for (const k of keys) if (k in skus) return Number(skus[k]);
  const cents = `cents_per_video_output_second_${resolution}`;
  if (cents in skus) return Number(skus[cents]) / 100;
  return null;
}

/** Video: duration * per-second @ chosen (or best supported) resolution. */
export function estimateVideo(model: ModelEntry, params: VideoParams): CostEstimate {
  if (model.serving === "fal" || model.serving === "ws") {
    const perVideo = num(model.pricing?.falPerVideo);
    if (perVideo !== null) return { usd: perVideo };
    const perSec = num(model.pricing?.falPerSecond);
    if (perSec !== null) return { usd: perSec * params.duration };
    return { usd: null, note: "단가 미상" };
  }
  const skus = model.pricing?.videoSkus;
  if (model.video?.tokenBased || (skus && "video_tokens" in skus)) {
    return { usd: null, note: "토큰제 — 실측 필요" };
  }
  const supported = model.video?.resolutions ?? RES_ORDER;
  const order = [params.resolution, ...RES_ORDER.filter((r) => supported.includes(r))];
  for (const res of order) {
    const ps = videoPerSecond(skus, res);
    if (ps !== null) return { usd: ps * params.duration };
  }
  return { usd: null, note: "단가 미상" };
}

export function formatUSD(usd: number | null): string {
  if (usd === null) return "—";
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
