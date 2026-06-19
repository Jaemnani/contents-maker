// Renders a page's media source full-bleed: pool/generated asset, upload, or a
// placeholder gradient when unresolved. Videos always muted (VO/BGM own the audio).
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo } from "remotion";
import type { PageSource } from "@/lib/ad/schema";
import { assetUrl, pathUrl, COLORS } from "@/remotion/lib/util";
import { COVER } from "@/remotion/lib/style";

const VIDEO_EXT = /\.(mp4|webm|mov)$/i;

export function sourceUrl(source: PageSource, assetBase: string): { url: string; video: boolean } | null {
  if (source.kind === "asset") {
    return {
      url: assetUrl(assetBase, source.ref.datasetPath, source.ref.file),
      video: source.ref.modality === "video",
    };
  }
  if (source.kind === "upload") {
    return { url: pathUrl(assetBase, source.path), video: VIDEO_EXT.test(source.path) };
  }
  return null;
}

export const SourceLayer: React.FC<{ source: PageSource; assetBase: string }> = ({ source, assetBase }) => {
  const res = sourceUrl(source, assetBase);
  if (!res) {
    return (
      <AbsoluteFill
        style={{ background: `linear-gradient(160deg, ${COLORS.ink} 0%, #1b2735 100%)`, justifyContent: "center", alignItems: "center" }}
      >
        <div style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Pretendard", fontWeight: 600, fontSize: 40 }}>
          소스 없음
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      {res.video ? <OffthreadVideo src={res.url} muted style={COVER} /> : <Img src={res.url} style={COVER} />}
    </AbsoluteFill>
  );
};
