// Caption renderer for every non-title layout. Applies the page's shared text style
// (font/size/weight/italic/spacing/color) + backdrop + intro effect. Default backdrop is
// the TapNow brand "banner" pill; the same fields drive the big title in fullscreen-title.
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { AdPage, AdProduct } from "@/lib/ad/schema";
import { textCss, introAnim, backdropBox, backdropShadow } from "@/remotion/ad/lib/text";
import { pageFrames } from "@/remotion/ad/lib/timeline";
import { AnimatedText } from "@/remotion/ad/components/AnimatedText";
import { wordsForPage } from "@/lib/ad/captions";

export const BRAND_FALLBACK = "#ff5a1f"; // TapNow-ish orange

export const CaptionBanner: React.FC<{
  text: string;
  product: AdProduct;
  page: AdPage;
  /** vertical placement from the bottom edge (px). */
  bottom?: number;
}> = ({ text, product, page, bottom = 220 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // karaoke pages render VO words even when the static caption is empty
  const karaoke = page.captionMode === "karaoke" && !!wordsForPage(page);
  if (!text && !karaoke) return null;
  const brand = product.brandColor || BRAND_FALLBACK;
  const backdrop = page.titleBackdrop ?? "banner";
  const pad = page.titlePadding ?? 28;
  const frames = pageFrames(page, fps);
  const { anim, filmOpacity } = introAnim(frame, fps, page.titleEffect ?? "fade", brand, frames);
  const base = textCss(page, { size: 56, weight: 800 });
  const box = backdropBox(backdrop, brand, pad);
  return (
    <>
      {filmOpacity > 0 && <div style={{ position: "absolute", inset: 0, background: `rgba(8,12,18,${filmOpacity})` }} />}
      <div style={{ position: "absolute", left: 0, right: 0, bottom, display: "flex", justifyContent: "center", padding: "0 60px", ...anim }}>
        <div style={{ ...base, lineHeight: 1.25, maxWidth: 940, textAlign: "center", whiteSpace: "pre-line", textShadow: backdropShadow(backdrop), ...box }}>
          <AnimatedText text={text} page={page} frame={frame} fps={fps} durationInFrames={frames} brand={brand} />
        </div>
      </div>
    </>
  );
};
