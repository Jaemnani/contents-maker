// Visual: sleek A/B comparison — two inset rounded media cards on a dark stage,
// slim corner tags + a thin VS chip on the divider. Slots A·B (B falls back to placeholder).
import React from "react";
import { AbsoluteFill } from "remotion";
import type { VisualProps } from "@/remotion/ad/types";
import { slotSource } from "@/lib/ad/schema";
import { SourceLayer } from "@/remotion/ad/components/SourceLayer";
import { CaptionBanner, BRAND_FALLBACK } from "@/remotion/ad/components/CaptionBanner";

const Tag: React.FC<{ letter: string; title?: string; brand: string }> = ({ letter, title, brand }) => (
  <div
    style={{
      position: "absolute",
      top: 28,
      left: 28,
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 18px 10px 10px",
      background: "rgba(11,15,20,0.55)",
      borderRadius: 999,
      boxShadow: "0 6px 22px rgba(0,0,0,0.30)",
    }}
  >
    <span
      style={{
        display: "grid",
        placeItems: "center",
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: brand,
        color: "#fff",
        fontFamily: "Pretendard",
        fontWeight: 900,
        fontSize: 26,
      }}
    >
      {letter}
    </span>
    {title ? (
      <span style={{ color: "#fff", fontFamily: "Pretendard", fontWeight: 700, fontSize: 30, paddingRight: 6, maxWidth: 380, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{title}</span>
    ) : null}
  </div>
);

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      position: "relative",
      flex: 1,
      overflow: "hidden",
      borderRadius: 40,
      border: "1.5px solid rgba(255,255,255,0.10)",
      boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
    }}
  >
    {children}
  </div>
);

export const Component: React.FC<VisualProps> = ({ page, product, assetBase }) => {
  const brand = product.brandColor || BRAND_FALLBACK;
  return (
    <AbsoluteFill style={{ background: "radial-gradient(120% 75% at 50% 0%, #1b232e 0%, #0a0e13 72%)" }}>
      {/* inset stage — cards float on the background, not edge-to-edge */}
      <div style={{ position: "absolute", top: 56, left: 48, right: 48, bottom: 210, display: "flex", flexDirection: "column", gap: 28 }}>
        <Card>
          <SourceLayer source={slotSource(page, "A")} assetBase={assetBase} />
          <Tag letter="A" title={page.compareLabelA} brand={brand} />
        </Card>
        <Card>
          <SourceLayer source={slotSource(page, "B")} assetBase={assetBase} />
          <Tag letter="B" title={page.compareLabelB} brand={brand} />
        </Card>

        {/* slim VS chip centered on the divider (relative to the stage, so it sits in the gap) */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            padding: "11px 24px",
            borderRadius: 16,
            background: brand,
            color: "#fff",
            fontFamily: "Pretendard",
            fontWeight: 900,
            fontSize: 28,
            letterSpacing: 5,
            boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
            border: "1.5px solid rgba(255,255,255,0.22)",
          }}
        >
          VS
        </div>
      </div>

      <CaptionBanner text={page.caption} product={product} bottom={90} />
    </AbsoluteFill>
  );
};
