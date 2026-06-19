// Endcard: logo + CTA button pill.
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { EndcardProps } from "@/remotion/ad/types";
import { COLORS, logoUrl } from "@/remotion/lib/util";
import { BRAND_FALLBACK } from "@/remotion/ad/components/CaptionBanner";

export const Component: React.FC<EndcardProps> = ({ endcard, product, assetBase }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoIn = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const s = spring({ frame: frame - 12, fps, config: { damping: 13, stiffness: 170 }, durationInFrames: 18 });
  const cta = endcard.cta || product.cta;
  return (
    <AbsoluteFill style={{ background: COLORS.canvas, justifyContent: "center", alignItems: "center", gap: 64 }}>
      <Img src={logoUrl(assetBase, product.logoPath)} style={{ width: 520, opacity: logoIn }} />
      <div
        style={{
          transform: `scale(${interpolate(s, [0, 1], [0.6, 1])})`,
          opacity: interpolate(frame, [12, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          background: product.brandColor || BRAND_FALLBACK,
          color: "#fff",
          fontFamily: "Pretendard",
          fontWeight: 900,
          fontSize: 52,
          padding: "30px 64px",
          borderRadius: 48,
          textAlign: "center",
          whiteSpace: "pre-line",
          lineHeight: 1.25,
          boxShadow: "0 14px 50px rgba(0,0,0,0.45)",
        }}
      >
        {cta}
      </div>
    </AbsoluteFill>
  );
};
