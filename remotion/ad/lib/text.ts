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

/** Intro animation for the text block (+ a full-frame film overlay opacity for "film"). */
export function introAnim(
  frame: number,
  fps: number,
  effect: AdPage["titleEffect"],
  brand: string
): { anim: React.CSSProperties; filmOpacity: number } {
  const fIn = (a: number, b: number) => interpolate(frame, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const spr = spring({ frame: frame - 2, fps, config: { damping: 18, stiffness: 120 }, durationInFrames: 20 });
  switch (effect) {
    case "film":
      return { filmOpacity: fIn(0, 12) * 0.42, anim: { opacity: fIn(8, 18), clipPath: `inset(0 ${(1 - fIn(8, 26)) * 100}% 0 0)` } };
    case "blur":
      return { filmOpacity: 0, anim: { opacity: fIn(2, 14), filter: `blur(${interpolate(frame, [2, 22], [22, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)` } };
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
