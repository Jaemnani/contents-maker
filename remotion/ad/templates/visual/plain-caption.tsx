// Visual: full-bleed source + caption banner only (generic b-roll page).
import React from "react";
import { AbsoluteFill } from "remotion";
import type { VisualProps } from "@/remotion/ad/types";
import { SourceLayer } from "@/remotion/ad/components/SourceLayer";
import { CaptionBanner } from "@/remotion/ad/components/CaptionBanner";

export const Component: React.FC<VisualProps> = ({ page, product, assetBase }) => (
  <AbsoluteFill>
    <SourceLayer source={page.source} assetBase={assetBase} />
    <CaptionBanner text={page.caption} product={product} />
  </AbsoluteFill>
);
