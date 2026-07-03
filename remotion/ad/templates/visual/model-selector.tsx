// Visual: model-selector dropdown overlay on the source (TapNow beat 6).
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { VisualProps } from "@/remotion/ad/types";
import { SourceLayer } from "@/remotion/ad/components/SourceLayer";
import { CaptionBanner, BRAND_FALLBACK } from "@/remotion/ad/components/CaptionBanner";

const MODELS = ["Sora 2", "Veo 3.1", "Kling 2.5", "Wan 2.5"];

export const Component: React.FC<VisualProps> = ({ page, product, assetBase }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brand = product.brandColor || BRAND_FALLBACK;
  const s = spring({ frame: frame - 3, fps, config: { damping: 16, stiffness: 170 }, durationInFrames: 18 });
  // highlight walks down the list (frames 10→34), then settles on the 2nd entry
  const walked = Math.floor(interpolate(frame, [10, 34], [0, MODELS.length - 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const hi = frame < 34 ? walked : 1;
  return (
    <AbsoluteFill>
      <SourceLayer source={page.source} assetBase={assetBase} />
      <div style={{ position: "absolute", inset: 0, background: "rgba(11,18,21,0.35)" }} />
      <div style={{ position: "absolute", top: 430, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scale(${interpolate(s, [0, 1], [0.85, 1])})`, opacity: interpolate(frame, [3, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        <div style={{ width: 620, background: "#fff", borderRadius: 26, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.45)" }}>
          <div style={{ padding: "24px 32px", fontFamily: "Pretendard", fontWeight: 900, fontSize: 32, color: "#0b1215", borderBottom: "1px solid #e5e7eb" }}>
            모델 선택
          </div>
          {MODELS.map((m, i) => (
            <div key={m} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 32px", fontFamily: "Pretendard", fontWeight: 600, fontSize: 32, color: i === hi ? "#fff" : "#0b1215", background: i === hi ? brand : "transparent" }}>
              {m}
              {i === hi && <span style={{ fontWeight: 900 }}>✓</span>}
            </div>
          ))}
        </div>
      </div>
      <CaptionBanner text={page.caption} product={product} page={page} bottom={170} />
    </AbsoluteFill>
  );
};
