// Visual: before/after slider — slot A (이전) fills the frame; slot B (이후) is overlaid
// and revealed by a vertical divider sweeping 8%→92% (the classic makeover reveal).
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { VisualProps } from "@/remotion/ad/types";
import { slotSource } from "@/lib/ad/schema";
import { pageFrames } from "@/remotion/ad/lib/timeline";
import { SourceLayer } from "@/remotion/ad/components/SourceLayer";
import { CaptionBanner, BRAND_FALLBACK } from "@/remotion/ad/components/CaptionBanner";

const Tag: React.FC<{ label: string; side: "left" | "right"; brand: string }> = ({ label, side, brand }) => (
  <div
    style={{
      position: "absolute",
      top: 96,
      [side]: 36,
      background: side === "left" ? "rgba(11,15,20,0.6)" : brand,
      color: "#fff",
      fontFamily: "Pretendard",
      fontWeight: 800,
      fontSize: 30,
      padding: "10px 22px",
      borderRadius: 999,
      maxWidth: 320,
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      boxShadow: "0 6px 22px rgba(0,0,0,0.3)",
    }}
  >
    {label}
  </div>
);

export const Component: React.FC<VisualProps> = ({ page, product, assetBase }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brand = product.brandColor || BRAND_FALLBACK;
  const frames = pageFrames(page, fps);
  // divider sweeps left→right, then holds near the right (mostly "after" visible)
  const x = interpolate(frame, [0, Math.max(8, frames * 0.7)], [8, 92], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#0b1215" }}>
      <SourceLayer source={slotSource(page, "A")} assetBase={assetBase} />
      {/* AFTER on top, clipped to the left of the divider */}
      <AbsoluteFill style={{ clipPath: `inset(0 ${100 - x}% 0 0)` }}>
        <SourceLayer source={slotSource(page, "B")} assetBase={assetBase} />
      </AbsoluteFill>
      {/* divider line + handle */}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: `${x}%`, width: 5, background: "#fff", boxShadow: "0 0 18px rgba(0,0,0,0.55)" }} />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: `${x}%`,
          transform: "translate(-50%, -50%)",
          width: 74,
          height: 74,
          borderRadius: "50%",
          background: "#fff",
          color: "#0b1215",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
          fontWeight: 900,
          boxShadow: "0 8px 26px rgba(0,0,0,0.45)",
        }}
      >
        ⇄
      </div>
      <Tag label={page.compareLabelB || "After"} side="left" brand={brand} />
      <Tag label={page.compareLabelA || "Before"} side="right" brand={brand} />
      <CaptionBanner text={page.caption} product={product} page={page} bottom={140} />
    </AbsoluteFill>
  );
};
