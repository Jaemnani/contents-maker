// Visual: phone mockup — the media inside a floating phone bezel (rounded frame + notch)
// on a soft brand-tinted stage; caption banner below. "In-app" product feel.
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { VisualProps } from "@/remotion/ad/types";
import { SourceLayer } from "@/remotion/ad/components/SourceLayer";
import { CaptionBanner, BRAND_FALLBACK } from "@/remotion/ad/components/CaptionBanner";

export const Component: React.FC<VisualProps> = ({ page, product, assetBase }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brand = product.brandColor || BRAND_FALLBACK;
  const s = spring({ frame: frame - 2, fps, config: { damping: 16, stiffness: 130 }, durationInFrames: 20 });
  const y = interpolate(s, [0, 1], [70, 0]);
  const op = interpolate(frame, [2, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(110% 70% at 50% 8%, ${brand}33 0%, #0b1215 62%)` }}>
      <div style={{ position: "absolute", top: 130, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `translateY(${y}px)`, opacity: op }}>
        {/* bezel */}
        <div style={{ position: "relative", width: 560, height: 1150, borderRadius: 84, background: "#111826", padding: 18, boxShadow: "0 40px 110px rgba(0,0,0,0.6), inset 0 0 0 3px rgba(255,255,255,0.08)" }}>
          {/* screen */}
          <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 66, overflow: "hidden", background: "#000" }}>
            <SourceLayer source={page.source} assetBase={assetBase} />
          </div>
          {/* notch */}
          <div style={{ position: "absolute", top: 34, left: "50%", transform: "translateX(-50%)", width: 170, height: 34, borderRadius: 20, background: "#111826" }} />
        </div>
      </div>
      <CaptionBanner text={page.caption} product={product} page={page} bottom={150} />
    </AbsoluteFill>
  );
};
