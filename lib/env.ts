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

// Rendering uses Remotion (bundles its own ffmpeg) — no system ffmpeg/ffprobe env needed.

// Trend providers (optional; empty string = provider disabled in the UI).
export const getYoutubeKey = () => process.env.YOUTUBE_API_KEY || "";
export const getNewsKey = () => process.env.NEWS_API_KEY || "";
export const getSerpApiKey = () => process.env.SERPAPI_KEY || "";

// Ad maker (v2): VO TTS via ElevenLabs.
export function getElevenLabsKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error("ELEVENLABS_API_KEY is not set. Add it to .env.local (https://elevenlabs.io).");
  }
  return key;
}
// Default voice: "Sarah" (a default-category voice — usable on the FREE tier; legacy
// premade voices like Rachel are now "library" voices and 402 on free plans).
// Override per .env.local for Korean-optimized voices.
export const getElevenLabsVoiceId = () => process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
// Script-compose model (OpenAI via OpenRouter).
export const getAdComposeModel = () => process.env.AD_COMPOSE_MODEL || "openai/gpt-4.1";
// BGM music-gen model (fal.ai text-to-music, async queue). Override per .env.local.
export const getAdMusicModel = () => process.env.AD_MUSIC_MODEL || "fal-ai/stable-audio";
