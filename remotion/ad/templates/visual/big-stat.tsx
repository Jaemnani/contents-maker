// Visual: dimmed media bg + one huge stat/number (the caption) + small label. Punchy proof.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { VisualProps } from "@/remotion/ad/types";
import { SourceLayer } from "@/remotion/ad/components/SourceLayer";
import { BRAND_FALLBACK } from "@/remotion/ad/components/CaptionBanner";
import { textCss, introAnim, backdropShadow } from "@/remotion/ad/lib/text";

export const Component: React.FC<VisualProps> = ({ page, product, assetBase }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brand = product.brandColor || BRAND_FALLBACK;
  const { anim } = introAnim(frame, fps, page.titleEffect ?? "pop", brand);
  return (
    <AbsoluteFill style={{ background: "#0b1215" }}>
      <SourceLayer source={page.source} assetBase={assetBase} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 42%, rgba(8,12,18,0.45) 0%, rgba(8,12,18,0.82) 70%)` }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 60px", flexDirection: "column", gap: 18 }}>
        <div style={{ ...textCss(page, { size: 200, weight: 900, color: brand }), textAlign: "center", whiteSpace: "pre-line", lineHeight: 1, textShadow: backdropShadow("none"), ...anim }}>
          {page.caption}
        </div>
        <div style={{ color: "rgba(255,255,255,0.85)", fontFamily: "Pretendard", fontWeight: 700, fontSize: 40, textAlign: "center" }}>{product.name}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
