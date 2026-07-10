// Caption renderer for every non-title layout. Applies the page's shared text style
// (font/size/weight/italic/spacing/color) + backdrop + intro effect. Default backdrop is
// the TapNow brand "banner" pill; the same fields drive the big title in fullscreen-title.
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { AdPage, AdProduct } from "@/lib/ad/schema";
import { textCss, introAnim, backdropBox, backdropShadow } from "@/remotion/ad/lib/text";
import { pageFrames } from "@/remotion/ad/lib/timeline";
import { AnimatedText } from "@/remotion/ad/components/AnimatedText";
import { wordsForPage, captionStepView } from "@/lib/ad/captions";

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
  if (page.titleVisible === false) return null; // per-page text on/off
  const pageDur = pageFrames(page, fps);
  // karaoke pages render VO words even when the static caption is empty
  const karaoke = page.captionMode === "karaoke" && !!wordsForPage(page);
  // caption steps override the single caption (each step replays its intro effect)
  const step = karaoke ? null : captionStepView(page, frame, pageDur);
  const vPage = step?.page ?? page;
  const vText = step ? step.text : text;
  const vFrame = step?.frame ?? frame;
  const frames = step?.frames ?? pageDur;
  if (!vText && !karaoke) return null;
  const brand = product.brandColor || BRAND_FALLBACK;
  const backdrop = vPage.titleBackdrop ?? "banner";
  const pad = vPage.titlePadding ?? 28;
  const { anim, filmOpacity } = introAnim(vFrame, fps, vPage.titleEffect ?? "fade", brand, frames);
  const base = textCss(vPage, { size: 56, weight: 800 });
  const box = backdropBox(backdrop, brand, pad);
  // titleY (% from top, block center) wins over the layout's default bottom offset
  const wrapPos: React.CSSProperties =
    page.titleY != null
      ? { top: `${page.titleY}%`, transform: `translateY(-50%)${anim.transform ? ` ${anim.transform}` : ""}` }
      : { bottom };
  return (
    <>
      {filmOpacity > 0 && <div style={{ position: "absolute", inset: 0, background: `rgba(8,12,18,${filmOpacity})` }} />}
      <div style={{ position: "absolute", left: 0, right: 0, display: "flex", justifyContent: "center", padding: "0 60px", ...anim, ...wrapPos }}>
        <div style={{ ...base, lineHeight: 1.25, maxWidth: 940, textAlign: "center", whiteSpace: "pre-line", textShadow: backdropShadow(backdrop), ...box }}>
          <AnimatedText text={vText} page={vPage} frame={vFrame} fps={fps} durationInFrames={frames} brand={brand} />
        </div>
      </div>
    </>
  );
};
