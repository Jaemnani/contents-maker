// Visual: note-canvas with a 2x2 collage of FOUR images + caption banner (TapNow beats 4·5).
// Image-only — slots A·B·C·D map to the four cards (each can be a different image).
import React from "react";
import { AbsoluteFill } from "remotion";
import type { VisualProps } from "@/remotion/ad/types";
import { slotSource, type SlotKey } from "@/lib/ad/schema";
import { SourceLayer } from "@/remotion/ad/components/SourceLayer";
import { CaptionBanner } from "@/remotion/ad/components/CaptionBanner";

const CARDS: { key: SlotKey; tilt: number }[] = [
  { key: "A", tilt: -2.2 },
  { key: "B", tilt: 1.6 },
  { key: "C", tilt: 1.2 },
  { key: "D", tilt: -1.4 },
];

export const Component: React.FC<VisualProps> = ({ page, product, assetBase }) => (
  <AbsoluteFill style={{ background: "#fafaf6" }}>
    {/* subtle dot grid */}
    <AbsoluteFill
      style={{
        backgroundImage: "radial-gradient(rgba(11,18,21,0.10) 2.5px, transparent 2.5px)",
        backgroundSize: "44px 44px",
      }}
    />
    <div style={{ position: "absolute", top: 200, left: 70, right: 70, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44 }}>
      {CARDS.map(({ key, tilt }) => (
        <div
          key={key}
          style={{
            position: "relative",
            height: 560,
            borderRadius: 24,
            overflow: "hidden",
            transform: `rotate(${tilt}deg)`,
            boxShadow: "0 16px 40px rgba(11,18,21,0.22)",
            background: "#fff",
            padding: 12,
          }}
        >
          <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 14, overflow: "hidden" }}>
            <SourceLayer source={slotSource(page, key)} assetBase={assetBase} />
          </div>
        </div>
      ))}
    </div>
    <CaptionBanner text={page.caption} product={product} bottom={190} />
  </AbsoluteFill>
);
