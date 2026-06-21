// Visual: full-bleed talking-head VIDEO + bottom caption banner (TapNow beats 3·8).
import React from "react";
import { AbsoluteFill } from "remotion";
import type { VisualProps } from "@/remotion/ad/types";
import { SourceLayer } from "@/remotion/ad/components/SourceLayer";
import { CaptionBanner, BRAND_FALLBACK } from "@/remotion/ad/components/CaptionBanner";

export const Component: React.FC<VisualProps> = ({ page, product, assetBase }) => (
  <AbsoluteFill>
    <SourceLayer source={page.source} assetBase={assetBase} />
    <div style={{ position: "absolute", top: 90, left: 60, background: "rgba(11,18,21,0.7)", color: "#fff", fontFamily: "Pretendard", fontWeight: 600, fontSize: 30, padding: "10px 24px", borderRadius: 999, border: `3px solid ${product.brandColor || BRAND_FALLBACK}` }}>
      {product.name}
    </div>
    <CaptionBanner text={page.caption} product={product} page={page} bottom={170} />
  </AbsoluteFill>
);
