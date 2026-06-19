// Visual: full-bleed source + big top title (hook page, TapNow beat 1).
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { VisualProps } from "@/remotion/ad/types";
import { SourceLayer } from "@/remotion/ad/components/SourceLayer";
import { BRAND_FALLBACK } from "@/remotion/ad/components/CaptionBanner";

export const Component: React.FC<VisualProps> = ({ page, product, assetBase }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 2, fps, config: { damping: 200 }, durationInFrames: 16 });
  const y = interpolate(s, [0, 1], [-36, 0]);
  const opacity = interpolate(frame, [2, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const pos = page.titlePosition ?? "top";
  // title block placement + a matching legibility scrim per position
  const wrap: React.CSSProperties =
    pos === "middle"
      ? { position: "absolute", inset: 0, justifyContent: "center" }
      : pos === "bottom"
        ? { position: "absolute", left: 0, right: 0, bottom: 240 }
        : { position: "absolute", left: 0, right: 0, top: 150 };
  const scrim =
    pos === "middle"
      ? "radial-gradient(ellipse 80% 45% at 50% 50%, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 70%)"
      : pos === "bottom"
        ? "linear-gradient(0deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 40%)"
        : "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 38%)";

  return (
    <AbsoluteFill>
      <SourceLayer source={page.source} assetBase={assetBase} />
      <div style={{ position: "absolute", inset: 0, background: scrim }} />
      <div style={{ ...wrap, display: "flex", flexDirection: "column", alignItems: "center", gap: 22, transform: `translateY(${y}px)`, opacity }}>
        <div style={{ background: product.brandColor || BRAND_FALLBACK, color: "#fff", fontFamily: "Pretendard", fontWeight: 600, fontSize: 32, padding: "10px 26px", borderRadius: 999 }}>
          {product.name}
        </div>
        <h1 style={{ margin: 0, color: "#fff", fontFamily: page.titleFont || "Pretendard", fontWeight: page.titleWeight ?? 900, fontSize: page.titleSize ?? 84, lineHeight: 1.18, textAlign: "center", maxWidth: 940, whiteSpace: "pre-line", textShadow: "0 6px 24px rgba(0,0,0,0.6)" }}>
          {page.caption}
        </h1>
      </div>
    </AbsoluteFill>
  );
};
