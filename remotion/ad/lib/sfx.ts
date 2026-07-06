// SFX rules — pure data + helpers (no React). Which transition gets a whoosh, and which
// title effects earn an entrance ding (only punchy ones — a ding on every page is noise).
import type { AdPage } from "@/lib/ad/schema";

export const DEFAULT_SFX_VOLUME = 0.7;

/** Transitions that play a whoosh as they start (cut/fade stay silent). */
const WHOOSH_TRANSITIONS = new Set([
  "slide",
  "wipe",
  "flip",
  "clock-wipe",
  "zoom-blur",
  "dreamy-zoom",
  "whip-pan",
  "glitch",
  "push",
  "iris",
  "diagonal-wipe",
  "spin-zoom",
]);

export function transitionWhoosh(transitionId: string): boolean {
  return WHOOSH_TRANSITIONS.has(transitionId);
}

/** Entrance ding: only pages whose text lands with a punch. */
const DING_EFFECTS = new Set(["pop", "stamp", "word-pop", "count-up"]);

export function pageDing(page: AdPage): boolean {
  const hasText = !!page.caption.trim() || page.captionMode === "karaoke";
  return hasText && DING_EFFECTS.has(page.titleEffect ?? "");
}
