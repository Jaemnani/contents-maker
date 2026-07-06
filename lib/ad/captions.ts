// Word-timing helpers for karaoke captions. Client-safe (no server imports) — used by
// the TTS pipeline (Gemini fallback) AND the Remotion renderer (legacy-audio fallback).
import type { AdPage } from "@/lib/ad/schema";

export interface WordTiming {
  w: string;
  s: number; // start (sec)
  e: number; // end (sec)
}

/**
 * Estimate word timings by distributing the measured duration proportionally to each
 * word's character length (used when the TTS provider gives no alignment).
 */
export function estimateWords(text: string, durationSec: number): WordTiming[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length || !(durationSec > 0)) return [];
  const pad = Math.min(0.05, durationSec * 0.02);
  const usable = durationSec - pad * 2;
  const totalChars = words.reduce((a, w) => a + w.length, 0);
  const out: WordTiming[] = [];
  let t = pad;
  for (const w of words) {
    const span = (w.length / totalChars) * usable;
    out.push({ w, s: round3(t), e: round3(t + span) });
    t += span;
  }
  return out;
}

/** Word timings for a page: stored (precise) → estimated from duration → null. */
export function wordsForPage(page: AdPage): WordTiming[] | null {
  const vo = page.voAudio;
  if (!vo) return null;
  if (vo.words?.length) return vo.words;
  const est = estimateWords(page.vo, vo.durationSec);
  return est.length ? est : null;
}

/** Split words into display chunks (쇼츠 표준: 3-5 words on screen at a time). */
export function chunkWords(words: WordTiming[], size = 4): WordTiming[][] {
  const out: WordTiming[][] = [];
  for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size));
  return out;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
