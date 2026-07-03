// Visual: top media + bottom brand panel with the caption. On entry the media starts
// FULLSCREEN and springs up into its 60% box (the bottom panel reveals underneath) — so a
// preceding full-bleed page of the same media reads as one continuous, still-playing shot.
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { VisualProps } from "@/remotion/ad/types";
import { SourceLayer } from "@/remotion/ad/components/SourceLayer";
import { BRAND_FALLBACK } from "@/remotion/ad/components/CaptionBanner";
import { textCss, introAnim } from "@/remotion/ad/lib/text";
import { pageFrames } from "@/remotion/ad/lib/timeline";

const MEDIA_PCT = 60; // settled height of the top media

export const Component: React.FC<VisualProps> = ({ page, product, assetBase }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brand = product.brandColor || BRAND_FALLBACK;

  // fullscreen → top box reveal (continuous, since it's the same media element)
  const reveal = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 18 });
  const mediaH = interpolate(reveal, [0, 1], [100, MEDIA_PCT]);
  const textOpacity = interpolate(frame, [10, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const { anim, filmOpacity } = introAnim(frame, fps, page.titleEffect ?? "fade", brand, pageFrames(page, fps));

  return (
    <AbsoluteFill style={{ background: brand }}>
      {/* bottom brand panel (revealed as the media shrinks) */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${100 - MEDIA_PCT}%`, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 80px" }}>
        <div style={{ ...textCss(page, { size: 64, weight: 900 }), textAlign: "center", whiteSpace: "pre-line", lineHeight: 1.2, ...anim, opacity: textOpacity * Number(anim.opacity ?? 1) }}>
          {page.caption}
        </div>
      </div>
      {filmOpacity > 0 && <div style={{ position: "absolute", inset: 0, background: `rgba(8,12,18,${filmOpacity})`, zIndex: 3 }} />}
      {/* top media — starts full-frame, springs to its box on top of the panel */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: `${mediaH}%`, overflow: "hidden", zIndex: 2 }}>
        <SourceLayer source={page.source} assetBase={assetBase} />
      </div>
    </AbsoluteFill>
  );
};
