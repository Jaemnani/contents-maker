// Endcard: logo blurs in from soft-focus to sharp (TapNow closer).
import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import type { EndcardProps } from "@/remotion/ad/types";
import { COLORS, logoUrl } from "@/remotion/lib/util";

export const Component: React.FC<EndcardProps> = ({ endcard, product, assetBase }) => {
  const frame = useCurrentFrame();
  const blur = interpolate(frame, [0, 22], [26, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, 22], [1.16, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sub = interpolate(frame, [20, 32], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subtitle = endcard.subtitle || product.oneLiner;
  return (
    <AbsoluteFill style={{ background: COLORS.canvas, justifyContent: "center", alignItems: "center", gap: 48 }}>
      <Img
        src={logoUrl(assetBase, product.logoPath)}
        style={{ width: 560, filter: `blur(${blur}px)`, transform: `scale(${scale})` }}
      />
      <div style={{ opacity: sub, color: "rgba(11,18,21,0.75)", fontFamily: "Pretendard", fontWeight: 600, fontSize: 44, textAlign: "center", maxWidth: 880, whiteSpace: "pre-line", lineHeight: 1.3 }}>
        {subtitle}
      </div>
    </AbsoluteFill>
  );
};
