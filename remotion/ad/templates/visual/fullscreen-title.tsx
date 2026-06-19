// Visual: full-bleed source + big top title (hook page, TapNow beat 1).
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { VisualProps } from "@/remotion/ad/types";
import { SourceLayer } from "@/remotion/ad/components/SourceLayer";
import { BRAND_FALLBACK } from "@/remotion/ad/components/CaptionBanner";

export const Component: React.FC<VisualProps> = ({ page, product, assetBase }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fIn = (a: number, b: number) => interpolate(frame, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const spr = spring({ frame: frame - 2, fps, config: { damping: 18, stiffness: 120 }, durationInFrames: 20 });

  const pos = page.titlePosition ?? "top";
  // title block placement + a matching legibility scrim per position
  const wrapPos: React.CSSProperties =
    pos === "middle"
      ? { position: "absolute", inset: 0, justifyContent: "center" }
      : pos === "bottom"
        ? { position: "absolute", left: 0, right: 0, bottom: 240 }
        : { position: "absolute", left: 0, right: 0, top: 150 };
  // legibility treatment behind the title. "scrim" = the old edge gradient (opt-in only);
  // default is a clean text outline so there is no dark gradient/blob by default.
  const backdrop = page.titleBackdrop ?? "outline";
  const scrim =
    pos === "bottom"
      ? "linear-gradient(0deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 30%)"
      : pos === "middle"
        ? "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.32) 50%, rgba(0,0,0,0) 70%)"
        : "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 30%)";

  // per-backdrop title styles (background box / glass / stroke) + matching text shadow
  const pad = page.titlePadding ?? 34;
  const boxPad = `${pad}px ${Math.round(pad * 1.4)}px`;
  const boxRadius = Math.round(18 + pad * 0.35);
  const titleBox: React.CSSProperties =
    backdrop === "panel"
      ? { background: "rgba(8,12,18,0.46)", padding: boxPad, borderRadius: boxRadius, display: "inline-block" }
      : backdrop === "glass"
        ? { background: "rgba(255,255,255,0.12)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.25)", padding: boxPad, borderRadius: boxRadius, display: "inline-block" }
        : backdrop === "outline"
          ? { WebkitTextStroke: "3px rgba(0,0,0,0.82)", paintOrder: "stroke fill" }
          : {};
  const titleShadow = backdrop === "scrim" || backdrop === "none" ? "0 1px 2px rgba(0,0,0,0.4)" : "none";

  // intro effect — how the title enters. "film" also fades a translucent overlay over the whole frame.
  const effect = page.titleEffect ?? "fade";
  let anim: React.CSSProperties = {};
  let filmOpacity = 0;
  if (effect === "film") {
    filmOpacity = fIn(0, 12) * 0.42;
    anim = { opacity: fIn(8, 18), clipPath: `inset(0 ${(1 - fIn(8, 26)) * 100}% 0 0)` }; // reveal left→right (written across)
  } else if (effect === "blur") {
    anim = { opacity: fIn(2, 14), filter: `blur(${interpolate(frame, [2, 22], [22, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)` };
  } else if (effect === "rise") {
    anim = { opacity: fIn(2, 12), clipPath: `inset(${(1 - spr) * 100}% 0 0 0)`, transform: `translateY(${interpolate(spr, [0, 1], [44, 0])}px)` };
  } else if (effect === "pop") {
    anim = { opacity: fIn(2, 10), transform: `scale(${interpolate(spr, [0, 1], [0.72, 1])})` };
  } else {
    anim = { opacity: fIn(2, 12), transform: `translateY(${interpolate(spr, [0, 1], [-28, 0])}px)` };
  }

  return (
    <AbsoluteFill>
      <SourceLayer source={page.source} assetBase={assetBase} />
      {backdrop === "scrim" && <div style={{ position: "absolute", inset: 0, background: scrim }} />}
      {/* film overlay (only the "film" effect drives its opacity above 0) */}
      <div style={{ position: "absolute", inset: 0, background: `rgba(8,12,18,${filmOpacity})` }} />
      <div style={{ ...wrapPos, display: "flex", flexDirection: "column", alignItems: "center", gap: 22, ...anim }}>
        <div style={{ background: product.brandColor || BRAND_FALLBACK, color: "#fff", fontFamily: "Pretendard", fontWeight: 600, fontSize: 32, padding: "10px 26px", borderRadius: 999 }}>
          {product.name}
        </div>
        <h1 style={{ margin: 0, color: "#fff", fontFamily: page.titleFont || "Pretendard", fontWeight: page.titleWeight ?? 900, fontSize: page.titleSize ?? 84, lineHeight: 1.18, textAlign: "center", maxWidth: 940, whiteSpace: "pre-line", textShadow: titleShadow, ...titleBox }}>
          {page.caption}
        </h1>
      </div>
    </AbsoluteFill>
  );
};
