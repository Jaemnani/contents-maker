// Shared types across client + server.

export type Modality = "text" | "image" | "video";
export type Language = "ko" | "ja" | "en";
export type Tier = "premium" | "standard" | "budget" | "free";
export type Serving = "openrouter" | "fal" | "ws";

export interface Pricing {
  prompt?: number | null; // USD per input token
  completion?: number | null; // USD per output token
  image?: number | null; // raw OpenRouter "image" field (not reliable as per-image cost)
  imageUnitUsd?: number | null; // curated approx USD per generated image (pre-gen estimate)
  request?: number | null; // USD per request (fixed)
  /** video: SKU map straight from /api/v1/videos/models pricing_skus */
  videoSkus?: Record<string, string> | null;
  /** fal video pricing: per output second, or flat per video */
  falPerSecond?: number | null;
  falPerVideo?: number | null;
}

export interface VideoMeta {
  resolutions?: string[];
  aspectRatios?: string[];
  durations?: number[];
  sizes?: string[];
  generateAudio?: boolean;
  tokenBased?: boolean; // priced per video_token (Seedance) -> est unavailable pre-gen
}

export interface ModelEntry {
  id: string; // raw provider model id (sent to the provider API)
  uid: string; // unique registry key = `${serving}:${id}` (used for keys/lookup/selection)
  label: string; // display name (fal models get a "(FAL)" suffix)
  provider: string;
  serving: Serving; // which platform serves this model
  modality: Modality;
  inputModalities: Modality[];
  outputModalities: Modality[];
  tier: Tier;
  supportsStreaming?: boolean;
  video?: VideoMeta;
  pricing?: Pricing;
  jaTextQuality?: "good" | "unknown"; // image/video JA text rendering
}

// ---- generation params (per content type) ----
export type TextMode = "marketing" | "raw";
export interface TextParams {
  maxTokens: number;
  mode: TextMode; // marketing = 5 channel variants; raw = direct answer to the prompt
}
export type ImageResolution = "1k" | "2k"; // 1k ≈ ~1MP (default); 2k ≈ long edge ~2048
export interface ImageParams {
  aspects: string[]; // e.g. ["1:1","9:16"]
  resolution: ImageResolution; // size-controllable providers only (fal image_size, WaveSpeed)
  enhance: boolean; // true = append overlay/lang guidance; false = prompt verbatim
}
export interface VideoParams {
  resolution: string; // "1080p" | "720p" | ...
  aspectRatio: string; // "9:16"
  duration: number; // seconds
  enhance: boolean; // true = append hook/lang guidance; false = prompt verbatim
}
export type GenParams = TextParams | ImageParams | VideoParams;

// ---- model selection ----
export type SelectionMode = "tier" | "direct" | "preset";

// ---- per-card result (client state + save payload) ----
export type ResultStatus = "idle" | "loading" | "streaming" | "processing" | "done" | "error";

export interface TextVariant {
  text: string;
  chars: number;
  targetChannels: string[];
}
export interface GenResult {
  model: string;
  status: ResultStatus;
  ms?: number;
  actualCost?: number | null;
  error?: string;
  // text
  raw?: string; // streamed raw text before parsing
  variants?: Record<string, TextVariant>;
  // image
  images?: { aspect: string; dataUrl: string }[];
  // video
  jobId?: string;
  videoUrl?: string;
  progress?: number;
}
