// Visual: full-bleed media, dimmed, with a big centered quote + attribution. Social proof.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { VisualProps } from "@/remotion/ad/types";
import { SourceLayer } from "@/remotion/ad/components/SourceLayer";
import { BRAND_FALLBACK } from "@/remotion/ad/components/CaptionBanner";
import { textCss, introAnim, backdropShadow } from "@/remotion/ad/lib/text";
import { pageFrames } from "@/remotion/ad/lib/timeline";

export const Component: React.FC<VisualProps> = ({ page, product, assetBase }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brand = product.brandColor || BRAND_FALLBACK;
  const { anim, filmOpacity } = introAnim(frame, fps, page.titleEffect ?? "fade", brand, pageFrames(page, fps));
  return (
    <AbsoluteFill>
      <SourceLayer source={page.source} assetBase={assetBase} />
      <AbsoluteFill style={{ background: "rgba(8,12,18,0.55)" }} />
      {filmOpacity > 0 && <AbsoluteFill style={{ background: `rgba(8,12,18,${filmOpacity})` }} />}
      {page.titleVisible !== false && (
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 90px" }}>
        <div style={{ textAlign: "center", ...anim }}>
          <div style={{ color: brand, fontFamily: "Pretendard", fontWeight: 900, fontSize: 150, lineHeight: 0.7 }}>“</div>
          <div style={{ ...textCss(page, { size: 70, weight: 800 }), textAlign: "center", whiteSpace: "pre-line", lineHeight: 1.3, textShadow: backdropShadow("none") }}>
            {page.caption}
          </div>
          {product.showName !== false && (
            <div style={{ marginTop: 26, color: "rgba(255,255,255,0.72)", fontFamily: "Pretendard", fontWeight: 600, fontSize: 30 }}>— {product.name}</div>
          )}
        </div>
      </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
