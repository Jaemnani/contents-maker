// Server-only env access. Do NOT import from client components.
import "server-only";

export function getOpenRouterKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Copy .env.example to .env.local and add your key (https://openrouter.ai/keys)."
    );
  }
  return key;
}

export const SITE_URL = process.env.OPENROUTER_SITE_URL || "http://localhost:3000";
export const SITE_NAME = process.env.OPENROUTER_SITE_NAME || "Content Maker";

export function getFalKey(): string {
  const key = process.env.FAL_API_KEY || process.env.FAL_KEY;
  if (!key) {
    throw new Error("FAL_API_KEY is not set. Add it to .env.local (https://fal.ai/dashboard/keys).");
  }
  return key;
}

export function getWaveSpeedKey(): string {
  const key = process.env.WAVESPEED_API_KEY;
  if (!key) {
    throw new Error("WAVESPEED_API_KEY is not set. Add it to .env.local (https://wavespeed.ai).");
  }
  return key;
}

export const getFfmpegPath = () => process.env.FFMPEG_PATH || "ffmpeg";
export const getFfprobePath = () => process.env.FFPROBE_PATH || "ffprobe";
export const BRAND_TEXT = process.env.BRAND_TEXT || "aibtown.com";
// BGM: explicit env path, else assets/bgm/track.mp3 (compose checks existence).
export const getBgmPath = () => process.env.BGM_PATH || "assets/bgm/track.mp3";
export const getTtsPath = (lang: "ko" | "ja") => process.env[`TTS_PATH_${lang.toUpperCase()}`] || `assets/tts/hook-${lang}.mp3`;
export const getLogoPath = () => process.env.LOGO_PATH || "assets/brand/logo.png";
