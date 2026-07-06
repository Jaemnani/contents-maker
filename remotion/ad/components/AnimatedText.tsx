// Per-char/word text animation for the five "글자 단위" title effects (typewriter,
// word-pop, wave, shake-text, count-up). Block-level effects (fade/film/…) just render
// the plain text — their animation is applied by the caller via introAnim. All motion is
// frame-seeded and deterministic (no Math.random — renders must be reproducible).
import React from "react";
import { interpolate, spring } from "remotion";
import type { AdPage } from "@/lib/ad/schema";
import { PER_CHAR_EFFECTS } from "@/remotion/ad/lib/text";

/** deterministic pseudo-random in [-1, 1] from integer seeds */
function jitter(a: number, b: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

export const AnimatedText: React.FC<{
  text: string;
  page: AdPage;
  frame: number;
  fps: number;
  durationInFrames: number;
  brand: string;
}> = ({ text, page, frame, fps, durationInFrames, brand }) => {
  const effect = page.titleEffect ?? "fade";
  if (!PER_CHAR_EFFECTS.has(effect)) return <>{text}</>;

  // same short-page compression factor as introAnim (ramps assume ~32+ frames)
  const k = durationInFrames < 32 ? Math.max(durationInFrames, 2) / 32 : 1;

  if (effect === "typewriter") {
    const chars = [...text];
    const perChar = Math.max(1, Math.round(1.6 * k)); // frames per character
    const visible = Math.min(chars.length, Math.floor(frame / perChar));
    const caretOn = visible < chars.length && Math.floor(frame / 8) % 2 === 0;
    return (
      <>
        {chars.slice(0, visible).join("")}
        <span style={{ opacity: caretOn ? 1 : 0, color: brand }}>▎</span>
      </>
    );
  }

  if (effect === "word-pop") {
    const words = text.split(/(\s+)/); // keep whitespace tokens so layout is unchanged
    let wi = 0;
    return (
      <>
        {words.map((w, i) => {
          if (/^\s+$/.test(w)) return <React.Fragment key={i}>{w}</React.Fragment>;
          const delay = Math.round((3 + wi++ * 4) * k);
          const s = spring({ frame: frame - delay, fps, config: { damping: 13, stiffness: 190 }, durationInFrames: Math.max(6, Math.round(14 * k)) });
          const op = interpolate(frame, [delay, delay + Math.max(2, Math.round(4 * k))], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <span key={i} style={{ display: "inline-block", whiteSpace: "pre", transform: `scale(${interpolate(s, [0, 1], [0.4, 1])})`, opacity: op }}>
              {w}
            </span>
          );
        })}
      </>
    );
  }

  if (effect === "wave") {
    return (
      <>
        {[...text].map((c, i) => (
          <span key={i} style={{ display: "inline-block", whiteSpace: "pre", transform: `translateY(${Math.sin(frame / 6 + i * 0.6) * 6}px)` }}>
            {c}
          </span>
        ))}
      </>
    );
  }

  if (effect === "shake-text") {
    const settle = Math.max(6, Math.round(18 * k));
    const amp = interpolate(frame, [0, settle], [7, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <>
        {[...text].map((c, i) => (
          <span key={i} style={{ display: "inline-block", whiteSpace: "pre", transform: `translate(${jitter(frame, i) * amp}px, ${jitter(frame + 57, i) * amp}px)` }}>
            {c}
          </span>
        ))}
      </>
    );
  }

  // count-up: animate the FIRST number in the caption from 0 → N; keep prefix/suffix.
  const m = text.match(/\d[\d,.]*/);
  if (!m || m.index == null) return <>{text}</>; // no number — static fallback
  const raw = m[0];
  const target = parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(target)) return <>{text}</>;
  const decimals = raw.includes(".") ? (raw.split(".")[1] ?? "").replace(/[^\d]/g, "").length : 0;
  const end = Math.max(4, Math.round(24 * k));
  const t = interpolate(frame, [0, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const eased = 1 - Math.pow(1 - t, 3);
  const val = (target * eased).toFixed(decimals);
  const shown = raw.includes(",") ? Number(val).toLocaleString("en-US", { minimumFractionDigits: decimals }) : val;
  return (
    <>
      {text.slice(0, m.index)}
      <span style={{ color: brand, fontVariantNumeric: "tabular-nums" }}>{shown}</span>
      {text.slice(m.index + raw.length)}
    </>
  );
};
