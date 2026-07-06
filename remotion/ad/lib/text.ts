// Shared on-screen text styling — intro animations + legibility backdrops — so the big
// title (fullscreen-title) and the caption banner (every other layout) behave identically.
import type React from "react";
import { interpolate, spring } from "remotion";
import type { AdPage } from "@/lib/ad/schema";
import { fontFamily } from "@/remotion/ad/lib/fonts";

/** Base text appearance from the page fields, with per-layout fallbacks. */
export function textCss(page: AdPage, opts: { size: number; weight: number; color?: string }): React.CSSProperties {
  return {
    fontFamily: fontFamily(page.titleFont),
    fontSize: page.titleSize ?? opts.size,
    fontWeight: page.titleWeight ?? opts.weight,
    fontStyle: page.titleItalic ? "italic" : "normal",
    letterSpacing: page.titleLetterSpacing != null ? page.titleLetterSpacing : undefined,
    color: page.titleColor || opts.color || "#fff",
  };
}

/** Effects rendered per-char/word by AnimatedText — introAnim only block-fades these. */
export const PER_CHAR_EFFECTS = new Set(["typewriter", "word-pop", "wave", "shake-text", "count-up"]);

/**
 * Intro animation for the text block (+ a full-frame film overlay opacity for "film").
 * `durationInFrames` (when known) compresses the ramps on short pages so the text is
 * never still invisible/mid-wipe when the page ends — keyframes assume ~32+ frames.
 */
export function introAnim(
  frame: number,
  fps: number,
  effect: AdPage["titleEffect"],
  brand: string,
  durationInFrames?: number
): { anim: React.CSSProperties; filmOpacity: number } {
  // scale factor: full-speed ramps need ~32 frames; shorter pages compress proportionally
  const k = durationInFrames && durationInFrames < 32 ? Math.max(durationInFrames, 2) / 32 : 1;
  const fIn = (a: number, b: number) =>
    interpolate(frame, [Math.round(a * k), Math.max(Math.round(a * k) + 1, Math.round(b * k))], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const spr = spring({ frame: frame - Math.round(2 * k), fps, config: { damping: 18, stiffness: 120 }, durationInFrames: Math.max(6, Math.round(20 * k)) });
  switch (effect) {
    case "film":
      return { filmOpacity: fIn(0, 12) * 0.42, anim: { opacity: fIn(8, 18), clipPath: `inset(0 ${(1 - fIn(8, 26)) * 100}% 0 0)` } };
    case "blur":
      return { filmOpacity: 0, anim: { opacity: fIn(2, 14), filter: `blur(${interpolate(fIn(2, 22), [0, 1], [22, 0])}px)` } };
    case "rise":
      return { filmOpacity: 0, anim: { opacity: fIn(2, 12), clipPath: `inset(${(1 - spr) * 100}% 0 0 0)`, transform: `translateY(${interpolate(spr, [0, 1], [44, 0])}px)` } };
    case "pop":
      return { filmOpacity: 0, anim: { opacity: fIn(2, 10), transform: `scale(${interpolate(spr, [0, 1], [0.72, 1])})` } };
    case "slide":
      return { filmOpacity: 0, anim: { opacity: fIn(2, 12), transform: `translateX(${interpolate(spr, [0, 1], [-70, 0])}px)` } };
    case "stamp":
      return { filmOpacity: 0, anim: { opacity: fIn(0, 4), transform: `scale(${interpolate(spr, [0, 1], [1.6, 1])})` } };
    case "neon": {
      const pulse = 0.5 + 0.5 * Math.sin(frame / 5);
      return { filmOpacity: 0, anim: { opacity: fIn(2, 10), filter: `drop-shadow(0 0 ${6 + pulse * 14}px ${brand}) drop-shadow(0 0 4px ${brand})` } };
    }
    case "typewriter":
    case "word-pop":
    case "wave":
    case "shake-text":
    case "count-up":
      // per-char/word motion lives in AnimatedText — block level just fades in fast
      return { filmOpacity: 0, anim: { opacity: fIn(0, 4) } };
    default: // fade
      return { filmOpacity: 0, anim: { opacity: fIn(2, 12), transform: `translateY(${interpolate(spr, [0, 1], [-28, 0])}px)` } };
  }
}

/** The box/outline style applied to the text element for a given backdrop. */
export function backdropBox(backdrop: AdPage["titleBackdrop"], brand: string, pad: number): React.CSSProperties {
  const boxPad = `${pad}px ${Math.round(pad * 1.4)}px`;
  const radius = Math.round(18 + pad * 0.35);
  switch (backdrop) {
    case "banner":
      return { background: brand, padding: `${Math.round(pad * 0.9)}px ${Math.round(pad * 1.6)}px`, borderRadius: 20, display: "inline-block", boxShadow: "0 8px 30px rgba(0,0,0,0.35)" };
    case "panel":
      return { background: "rgba(8,12,18,0.46)", padding: boxPad, borderRadius: radius, display: "inline-block" };
    case "glass":
      return { background: "rgba(255,255,255,0.12)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.25)", padding: boxPad, borderRadius: radius, display: "inline-block" };
    case "highlight":
      return { background: `linear-gradient(transparent 60%, ${brand} 60%)`, padding: "0 0.12em", display: "inline" };
    case "outline":
      return { WebkitTextStroke: "3px rgba(0,0,0,0.82)", paintOrder: "stroke fill" } as React.CSSProperties;
    default: // none / scrim (scrim is drawn full-frame by the caller)
      return {};
  }
}

/** Text shadow only for treatments without a box/stroke (keeps legibility on busy media). */
export function backdropShadow(backdrop: AdPage["titleBackdrop"]): string {
  return backdrop === "scrim" || backdrop === "none" || backdrop == null ? "0 1px 2px rgba(0,0,0,0.4)" : "none";
}
