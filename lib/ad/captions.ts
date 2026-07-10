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

// ── caption steps ─────────────────────────────────────────────────────────────
// Steps replace the single caption: the page duration is split equally, each step's
// text shows in order and re-runs its intro effect with its own style overrides.

export interface CaptionStepView {
  page: AdPage; // page with the active step's text/style merged over the base style
  frame: number; // frame LOCAL to the step (so the intro effect replays per step)
  frames: number; // the step's own duration in frames (for effect-ramp compression)
  text: string;
}

/** Active caption step for a frame, or null when the page has no steps (karaoke wins upstream). */
export function captionStepView(page: AdPage, frame: number, durationInFrames: number): CaptionStepView | null {
  const steps = page.captionSteps;
  if (!steps?.length || durationInFrames <= 0) return null;
  const per = durationInFrames / steps.length;
  const i = Math.min(steps.length - 1, Math.max(0, Math.floor(frame / per)));
  const s = steps[i];
  return {
    page: {
      ...page,
      caption: s.text,
      titleFont: s.font ?? page.titleFont,
      titleColor: s.color ?? page.titleColor,
      titleSize: s.size ?? page.titleSize,
      titleWeight: s.weight ?? page.titleWeight,
      titleEffect: s.effect ?? page.titleEffect,
    },
    frame: Math.max(0, frame - Math.floor(i * per)),
    frames: Math.max(1, Math.floor(per)),
    text: s.text,
  };
}
