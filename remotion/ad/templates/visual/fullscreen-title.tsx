// Visual: full-bleed source + big title (hook page). Title position + the shared text
// style (font/size/weight/effect/backdrop…) come from the page; same helpers as captions.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { VisualProps } from "@/remotion/ad/types";
import { SourceLayer } from "@/remotion/ad/components/SourceLayer";
import { BRAND_FALLBACK } from "@/remotion/ad/components/CaptionBanner";
import { textCss, introAnim, backdropBox, backdropShadow } from "@/remotion/ad/lib/text";
import { pageFrames } from "@/remotion/ad/lib/timeline";

export const Component: React.FC<VisualProps> = ({ page, product, assetBase }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brand = product.brandColor || BRAND_FALLBACK;

  const pos = page.titlePosition ?? "top";
  const wrapPos: React.CSSProperties =
    pos === "middle"
      ? { position: "absolute", inset: 0, justifyContent: "center" }
      : pos === "bottom"
        ? { position: "absolute", left: 0, right: 0, bottom: 240 }
        : { position: "absolute", left: 0, right: 0, top: 150 };

  const backdrop = page.titleBackdrop ?? "outline"; // big titles default to a clean outline
  const scrim =
    pos === "bottom"
      ? "linear-gradient(0deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 30%)"
      : pos === "middle"
        ? "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.32) 50%, rgba(0,0,0,0) 70%)"
        : "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 30%)";

  const { anim, filmOpacity } = introAnim(frame, fps, page.titleEffect ?? "fade", brand, pageFrames(page, fps));
  const base = textCss(page, { size: 84, weight: 900 });
  const box = backdropBox(backdrop, brand, page.titlePadding ?? 34);

  return (
    <AbsoluteFill>
      <SourceLayer source={page.source} assetBase={assetBase} />
      {backdrop === "scrim" && <div style={{ position: "absolute", inset: 0, background: scrim }} />}
      {filmOpacity > 0 && <div style={{ position: "absolute", inset: 0, background: `rgba(8,12,18,${filmOpacity})` }} />}
      <div style={{ ...wrapPos, display: "flex", flexDirection: "column", alignItems: "center", gap: 22, ...anim }}>
        <div style={{ background: brand, color: "#fff", fontFamily: "Pretendard", fontWeight: 600, fontSize: 32, padding: "10px 26px", borderRadius: 999 }}>
          {product.name}
        </div>
        <h1 style={{ ...base, margin: 0, lineHeight: 1.18, textAlign: "center", maxWidth: 940, whiteSpace: "pre-line", textShadow: backdropShadow(backdrop), ...box }}>
          {page.caption}
        </h1>
      </div>
    </AbsoluteFill>
  );
};
