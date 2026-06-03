// Publishing-channel-based defaults & constraints (concern #8).
// These drive UI defaults and the targetChannels written into meta.json.
import type { Language } from "@/lib/types";

// ---- Text: 5 length variants generated in one call, mapped to channels ----
export interface TextVariantSpec {
  id: string;
  label: string;
  minChars: number;
  maxChars: number;
  targetChannels: string[];
}
export const TEXT_VARIANTS: TextVariantSpec[] = [
  { id: "short", label: "Short", minChars: 60, maxChars: 100, targetChannels: ["x", "facebook"] },
  { id: "medium", label: "Medium", minChars: 130, maxChars: 150, targetChannels: ["instagram", "tiktok", "youtube_shorts"] },
  { id: "thread", label: "Thread", minChars: 200, maxChars: 300, targetChannels: ["threads"] },
  { id: "line", label: "Line", minChars: 200, maxChars: 500, targetChannels: ["line"] },
  { id: "long", label: "Long", minChars: 800, maxChars: 1500, targetChannels: ["naver_blog"] },
];
export const TEXT_VARIANT_IDS = TEXT_VARIANTS.map((v) => v.id);

// ---- Image aspects ----
export interface AspectSpec { id: string; label: string; note: string }
export const IMAGE_ASPECTS: AspectSpec[] = [
  { id: "1:1", label: "1:1", note: "instagram feed" },
  { id: "9:16", label: "9:16", note: "story / reels cover" },
  { id: "4:5", label: "4:5", note: "instagram feed (tall)" },
];
export const IMAGE_DEFAULT_ASPECTS = ["1:1", "9:16"];
// Resolution tiers. Applies only to fal image_size models + WaveSpeed (aspect-only providers ignore it).
export const IMAGE_RESOLUTIONS: { id: "1k" | "2k"; label: string; note: string }[] = [
  { id: "1k", label: "1K", note: "~1MP · 빠르고 저렴" },
  { id: "2k", label: "2K", note: "긴 변 ~2048 · 지원 모델만" },
];
// Overlay guidance auto-appended to image prompts (story safe area).
export const IMAGE_OVERLAY_GUIDANCE =
  "Place any overlaid text only within the central 60% safe area (avoid top/bottom edges used by story UI).";

// ---- Video defaults ----
export const VIDEO_DEFAULTS = {
  aspectRatio: "9:16",
  resolution: "1080p",
  duration: 8,
  durationOptions: [4, 5, 8, 10, 15, 30, 60],
  warnDurationAtOrAbove: 30,
};
export const VIDEO_HOOK_GUIDANCE =
  "Open with a strong visual hook in the first 3 seconds to maximize completion rate.";

// ---- Publishing channels per language ----
export const CHANNELS_BY_LANGUAGE: Record<Language, string[]> = {
  ko: ["instagram", "youtube", "tiktok", "naver_blog", "x", "threads"],
  ja: ["line", "x", "youtube", "instagram", "tiktok", "facebook"],
  en: ["instagram", "youtube", "tiktok", "x", "threads", "facebook"],
};

export const LANGUAGE_LABELS: Record<Language, string> = { ko: "한국어", ja: "日本語", en: "English" };
export const LANGUAGE_NAMES: Record<Language, string> = { ko: "Korean", ja: "Japanese", en: "English" };
