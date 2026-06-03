// Curated WaveSpeed models. LLM ids verified live; image/video slugs from model-page URLs
// (some best-guess, easily editable). Pricing from WaveSpeed's published table.
import type { ImageResolution, ModelEntry, Modality, Tier } from "@/lib/types";
import { clampDims } from "@/lib/image-size";

export interface WsModelDef {
  id: string; // WS model slug (image/video) or LLM id
  label: string; // includes "(WS)"
  provider: string;
  modality: Modality;
  tier: Tier;
  jaTextQuality?: "good" | "unknown";
  // text (LLM, per-token USD)
  promptUsd?: number;
  completionUsd?: number;
  // image (per image)
  imageUnitUsd?: number;
  aspectMode?: "aspect_ratio" | "size"; // default "size" ("W*H"); Google nano-banana needs "aspect_ratio"
  imageMaxDim?: number; // clamp 2K requests to this model's max long edge (px), if it caps below 2048
  // video
  durations?: number[];
  aspectRatios?: string[];
  perSecond?: number;
  verified?: boolean; // slug confirmed via live call/URL
}

// aspect -> "W*H" size string for WS image models. 1K ≈ ~1MP; 2K ≈ long edge ~2048.
export const WS_ASPECT_SIZE: Record<string, string> = {
  "1:1": "1024*1024",
  "9:16": "768*1344",
  "4:5": "1024*1280",
  "16:9": "1344*768",
};
export const WS_ASPECT_SIZE_2K: Record<string, string> = {
  "1:1": "2048*2048",
  "9:16": "1152*2048",
  "4:5": "1632*2048",
  "16:9": "2048*1152",
};
export function wsImageSize(aspect: string, resolution: ImageResolution, maxDim?: number): string {
  const table = resolution === "2k" ? WS_ASPECT_SIZE_2K : WS_ASPECT_SIZE;
  const [w, h] = (table[aspect] ?? table["1:1"]).split("*").map(Number);
  const d = clampDims({ width: w, height: h }, maxDim);
  return `${d.width}*${d.height}`;
}

export const WS_MODELS: WsModelDef[] = [
  // ---- TEXT (OpenAI-compatible, verified) ----
  { id: "anthropic/claude-opus-4.6", label: "Claude Opus 4.6 (WS)", provider: "anthropic", modality: "text", tier: "premium", promptUsd: 1.5e-5, completionUsd: 7.5e-5, verified: true },
  { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6 (WS)", provider: "anthropic", modality: "text", tier: "premium", promptUsd: 3e-6, completionUsd: 1.5e-5, verified: true },
  { id: "openai/gpt-5.4", label: "GPT-5.4 (WS)", provider: "openai", modality: "text", tier: "premium", promptUsd: 1e-5, completionUsd: 3e-5, verified: true },
  { id: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini (WS)", provider: "openai", modality: "text", tier: "budget", promptUsd: 4e-7, completionUsd: 1.6e-6, verified: true },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (WS)", provider: "google", modality: "text", tier: "standard", promptUsd: 1.25e-6, completionUsd: 5e-6, verified: true },
  { id: "qwen/qwen3-max", label: "Qwen3 Max (WS)", provider: "qwen", modality: "text", tier: "standard", promptUsd: 1.2e-6, completionUsd: 4.8e-6, verified: true },
  { id: "deepseek/deepseek-chat", label: "DeepSeek V4 (WS)", provider: "deepseek", modality: "text", tier: "standard", promptUsd: 7e-7, completionUsd: 2.8e-6, verified: true },

  // ---- IMAGE (predict+poll; size "W*H") ----
  { id: "wavespeed-ai/z-image/turbo", label: "Z Image Turbo (WS)", provider: "tongyi", modality: "image", tier: "budget", jaTextQuality: "good", imageUnitUsd: 0.005, imageMaxDim: 1536, verified: true }, // rejects sizes above ~1536 long edge
  // Flux 2 Klein omitted — WS slug couldn't be confirmed without risking a charge; add once known.
  { id: "bytedance/seedream-v4.5", label: "Seedream 4.5 (WS)", provider: "bytedance", modality: "image", tier: "standard", jaTextQuality: "good", imageUnitUsd: 0.04, verified: true },
  { id: "google/nano-banana-2/text-to-image", label: "Nano Banana 2 (WS)", provider: "google", modality: "image", tier: "premium", jaTextQuality: "good", imageUnitUsd: 0.07, aspectMode: "aspect_ratio", verified: true },
  { id: "google/nano-banana-pro/text-to-image", label: "Nano Banana Pro (WS)", provider: "google", modality: "image", tier: "premium", jaTextQuality: "good", imageUnitUsd: 0.14, aspectMode: "aspect_ratio", verified: true },

  // ---- VIDEO (predict+poll; text-to-video only) ----
  { id: "wavespeed-ai/wan-2.2/t2v-480p-ultra-fast", label: "Wan 2.2 Ultra Fast (WS)", provider: "alibaba", modality: "video", tier: "budget", durations: [5, 8], aspectRatios: ["16:9", "9:16"], perSecond: 0.01, verified: true },
  { id: "kwaivgi/kling-v3.0-std/text-to-video", label: "Kling 3.0 Std (WS)", provider: "kuaishou", modality: "video", tier: "standard", durations: [5, 10], aspectRatios: ["16:9", "9:16", "1:1"], perSecond: 0.084, verified: true },
  { id: "bytedance/seedance-2.0-fast/text-to-video", label: "Seedance 2.0 Fast (WS)", provider: "bytedance", modality: "video", tier: "standard", durations: [5, 8, 10], aspectRatios: ["16:9", "9:16"], perSecond: 0.10, verified: true },
  { id: "alibaba/wan-2.7/text-to-video", label: "Wan 2.7 (WS)", provider: "alibaba", modality: "video", tier: "standard", durations: [5, 10], aspectRatios: ["16:9", "9:16"], perSecond: 0.10, verified: true },
  { id: "google/veo3-fast", label: "Veo 3.1 Fast (WS)", provider: "google", modality: "video", tier: "premium", durations: [8], aspectRatios: ["16:9", "9:16"], perSecond: 0.15, verified: true },
];

export const WS_DEFS_BY_ID: Record<string, WsModelDef> = Object.fromEntries(WS_MODELS.map((m) => [m.id, m]));

export function wsModelEntries(): Omit<ModelEntry, "uid">[] {
  return WS_MODELS.map((m): Omit<ModelEntry, "uid"> => {
    const base = {
      id: m.id, label: m.label, provider: m.provider, serving: "ws" as const,
      tier: m.tier, jaTextQuality: m.jaTextQuality ?? "unknown",
    };
    if (m.modality === "text") {
      return {
        ...base, modality: "text", inputModalities: ["text"], outputModalities: ["text"],
        supportsStreaming: true, pricing: { prompt: m.promptUsd ?? null, completion: m.completionUsd ?? null },
      };
    }
    if (m.modality === "image") {
      return {
        ...base, modality: "image", inputModalities: ["text"], outputModalities: ["image", "text"],
        pricing: { imageUnitUsd: m.imageUnitUsd ?? null },
      };
    }
    return {
      ...base, modality: "video", inputModalities: ["text"], outputModalities: ["video"],
      video: { durations: m.durations, aspectRatios: m.aspectRatios },
      pricing: { falPerSecond: m.perSecond ?? null },
    };
  });
}
