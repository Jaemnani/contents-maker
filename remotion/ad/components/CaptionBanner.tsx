// TapNow-style caption banner: rounded brand-colored box, bold white text.
// Shared by visual templates; optional spring pop-in (used by motion "caption-pop"
// via the static variant + its own wrapper, and here for standalone entrance).
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { AdProduct } from "@/lib/ad/schema";

export const BRAND_FALLBACK = "#ff5a1f"; // TapNow-ish orange

export const captionBoxStyle = (product: AdProduct): React.CSSProperties => ({
  background: product.brandColor || BRAND_FALLBACK,
  color: "#fff",
  fontFamily: "Pretendard",
  fontWeight: 900,
  fontSize: 56,
  lineHeight: 1.25,
  padding: "26px 44px",
  borderRadius: 20,
  maxWidth: 920,
  textAlign: "center",
  whiteSpace: "pre-line",
  boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
});

export const CaptionBanner: React.FC<{
  text: string;
  product: AdProduct;
  /** vertical placement from the bottom edge (px). */
  bottom?: number;
  /** spring pop-in entrance; 0 disables. */
  popDelay?: number | null;
}> = ({ text, product, bottom = 220, popDelay = 4 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!text) return null;
  let transform = "none";
  let opacity = 1;
  if (popDelay !== null) {
    const s = spring({ frame: frame - popDelay, fps, config: { damping: 14, stiffness: 160 }, durationInFrames: 18 });
    transform = `scale(${interpolate(s, [0, 1], [0.7, 1])})`;
    opacity = interpolate(frame, [popDelay, popDelay + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  }
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom, display: "flex", justifyContent: "center" }}>
      <div style={{ ...captionBoxStyle(product), transform, opacity }}>{text}</div>
    </div>
  );
};
