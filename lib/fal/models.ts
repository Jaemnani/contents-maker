// Curated fal.ai models + their request-building config.
// Source of truth for both the registry (ModelEntry) and the fal request builders.
import type { ImageResolution, ModelEntry, Modality, Tier } from "@/lib/types";
import { pickDims, type Dims } from "@/lib/image-size";

export interface FalModelDef {
  id: string; // fal endpoint id
  label: string; // includes "(FAL)" suffix
  provider: string;
  modality: Modality;
  tier: Tier;
  jaTextQuality?: "good" | "unknown";
  // image
  aspectMode?: "aspect_ratio" | "image_size";
  imageUnitUsd?: number;
  imageMaxDim?: number; // clamp 2K requests to this model's max long edge (px), if it caps below 2048
  // video
  durations?: number[];
  resolutions?: string[];
  aspectRatios?: string[];
  durationFormat?: "Ns" | "N"; // veo wants "8s", kling wants "10"
  generateAudio?: boolean;
  falPerSecond?: number;
  falPerVideo?: number;
  falResolutionByAspect?: Record<string, string>; // e.g. Ovi uses "512x992" dimension strings
}

// Aspect -> pixel dims for models that use image_size:{width,height}. 1K ≈ ~1MP; 2K ≈ long edge ~2048.
export const FAL_ASPECT_DIMS: Record<string, Dims> = {
  "1:1": { width: 1024, height: 1024 },
  "9:16": { width: 768, height: 1344 },
  "4:5": { width: 1024, height: 1280 },
  "16:9": { width: 1344, height: 768 },
};
export const FAL_ASPECT_DIMS_2K: Record<string, Dims> = {
  "1:1": { width: 2048, height: 2048 },
  "9:16": { width: 1152, height: 2048 },
  "4:5": { width: 1632, height: 2048 },
  "16:9": { width: 2048, height: 1152 },
};
export const falImageSize = (aspect: string, resolution: ImageResolution, maxDim?: number): Dims =>
  pickDims(FAL_ASPECT_DIMS, FAL_ASPECT_DIMS_2K, aspect, resolution, maxDim);

export const FAL_MODELS: FalModelDef[] = [
  // ---- IMAGE (sync) ----
  {
    id: "fal-ai/nano-banana", label: "Nano Banana (FAL)", provider: "google",
    modality: "image", tier: "standard", jaTextQuality: "good",
    aspectMode: "aspect_ratio", imageUnitUsd: 0.0398,
  },
  {
    id: "fal-ai/bytedance/seedream/v4/text-to-image", label: "Seedream V4 (FAL)", provider: "bytedance",
    modality: "image", tier: "standard", jaTextQuality: "good",
    aspectMode: "image_size", imageUnitUsd: 0.03,
  },
  {
    id: "fal-ai/qwen-image", label: "Qwen Image (FAL)", provider: "qwen",
    modality: "image", tier: "budget", jaTextQuality: "good",
    aspectMode: "image_size", imageUnitUsd: 0.02, imageMaxDim: 1536, // caps long edge at 1536
  },
  {
    // user listed "Flux Kontext Pro" but Kontext is image-EDITING (needs an input image);
    // for text-to-image we use Flux dev (verified text-to-image endpoint).
    id: "fal-ai/flux/dev", label: "Flux Dev (FAL)", provider: "black-forest-labs",
    modality: "image", tier: "budget", jaTextQuality: "unknown",
    aspectMode: "image_size", imageUnitUsd: 0.025,
  },

  // ---- VIDEO (queue) ----
  {
    id: "fal-ai/veo3.1", label: "Veo 3.1 (FAL)", provider: "google",
    modality: "video", tier: "premium",
    durations: [4, 6, 8], resolutions: ["720p", "1080p"], aspectRatios: ["16:9", "9:16"],
    durationFormat: "Ns", generateAudio: true, falPerSecond: 0.4,
  },
  {
    id: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video", label: "Kling 2.5 Turbo Pro (FAL)", provider: "kuaishou",
    modality: "video", tier: "standard",
    durations: [5, 10], aspectRatios: ["16:9", "9:16", "1:1"],
    durationFormat: "N", falPerSecond: 0.07,
  },
  {
    id: "fal-ai/wan-25-preview/text-to-video", label: "Wan 2.5 (FAL)", provider: "alibaba",
    modality: "video", tier: "budget",
    durations: [5, 10], resolutions: ["480p", "720p", "1080p"], aspectRatios: ["16:9", "9:16", "1:1"],
    durationFormat: "N", falPerSecond: 0.05,
  },
  {
    // Ovi: per-video price, no duration/aspect param — orientation via dimension-string resolution.
    id: "fal-ai/ovi", label: "Ovi (FAL)", provider: "ovi",
    modality: "video", tier: "standard", generateAudio: true, falPerVideo: 0.2,
    falResolutionByAspect: { "9:16": "512x992", "16:9": "992x512", "1:1": "720x720" },
  },
];

export const FAL_DEFS_BY_ID: Record<string, FalModelDef> = Object.fromEntries(
  FAL_MODELS.map((m) => [m.id, m])
);

export function falModelEntries(): Omit<ModelEntry, "uid">[] {
  return FAL_MODELS.map((m) => {
    if (m.modality === "image") {
      return {
        id: m.id, label: m.label, provider: m.provider, serving: "fal",
        modality: "image", inputModalities: ["text"], outputModalities: ["image", "text"],
        tier: m.tier, jaTextQuality: m.jaTextQuality ?? "unknown",
        pricing: { imageUnitUsd: m.imageUnitUsd ?? null },
      };
    }
    return {
      id: m.id, label: m.label, provider: m.provider, serving: "fal",
      modality: "video", inputModalities: ["text"], outputModalities: ["video"],
      tier: m.tier, jaTextQuality: m.jaTextQuality ?? "unknown",
      video: {
        resolutions: m.resolutions, aspectRatios: m.aspectRatios,
        durations: m.durations, generateAudio: m.generateAudio,
      },
      pricing: { falPerSecond: m.falPerSecond ?? null, falPerVideo: m.falPerVideo ?? null },
    };
  });
}
