// Visual: checklist reveal — the caption's newline-separated lines (3-5 bullets) pop in
// one by one with a brand-colored check, over a dimmed media background.
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { VisualProps } from "@/remotion/ad/types";
import { SourceLayer } from "@/remotion/ad/components/SourceLayer";
import { BRAND_FALLBACK } from "@/remotion/ad/components/CaptionBanner";
import { fontFamily } from "@/remotion/ad/lib/fonts";

const MAX_LINES = 5;

export const Component: React.FC<VisualProps> = ({ page, product, assetBase }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brand = product.brandColor || BRAND_FALLBACK;
  const lines = page.caption.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, MAX_LINES);
  const family = fontFamily(page.titleFont);
  return (
    <AbsoluteFill>
      <SourceLayer source={page.source} assetBase={assetBase} />
      <AbsoluteFill style={{ background: "rgba(8,12,18,0.6)" }} />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 110px", gap: 34 }}>
        {lines.map((line, i) => {
          const delay = 6 + i * 9;
          const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 170 }, durationInFrames: 16 });
          const op = interpolate(frame, [delay, delay + 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 26, opacity: op, transform: `translateX(${interpolate(s, [0, 1], [-46, 0])}px)` }}>
              <div style={{ width: 58, height: 58, borderRadius: 16, background: brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 900, flexShrink: 0, transform: `scale(${interpolate(s, [0, 1], [0.4, 1])})` }}>
                ✓
              </div>
              <div style={{ color: page.titleColor || "#fff", fontFamily: family, fontWeight: page.titleWeight ?? 800, fontSize: page.titleSize ?? 52, lineHeight: 1.2, textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
                {line}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
