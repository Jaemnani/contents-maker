// Renders a page's media source full-bleed: pool/generated asset, upload, or a
// placeholder gradient when unresolved. Videos always muted (VO/BGM own the audio) and
// LOOP, so a short clip keeps playing. Same-source consecutive pages resume continuously
// via a negative-offset Sequence (Remotion wraps the looped time = (offset+frame) % len).
import React, { useContext } from "react";
import { AbsoluteFill, Img, Sequence, Video } from "remotion";
import type { PageSource } from "@/lib/ad/schema";
import { assetUrl, pathUrl, COLORS } from "@/remotion/lib/util";
import { COVER } from "@/remotion/lib/style";
import { videoSourceKey } from "@/remotion/ad/lib/timeline";

const VIDEO_EXT = /\.(mp4|webm|mov)$/i;

/** Resume info for the page's PRIMARY video: trim `frames` from the start, but only for
 *  the source matching `key` — other slots (compare-2up B, grid C/D) must start at 0. */
export const MediaStartContext = React.createContext<{ frames: number; key: string | null }>({ frames: 0, key: null });

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
  const mediaStart = useContext(MediaStartContext);
  // the resume offset belongs only to the source it was computed for
  const trimBefore = mediaStart.key && videoSourceKey(source) === mediaStart.key ? mediaStart.frames : 0;
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
  if (!res.video) {
    return (
      <AbsoluteFill>
        <Img src={res.url} style={COVER} />
      </AbsoluteFill>
    );
  }
  const video = <Video src={res.url} muted loop style={COVER} />;
  return (
    <AbsoluteFill>
      {/* shift local frame so the loop resumes where the previous same-source page ended */}
      {trimBefore > 0 ? <Sequence from={-trimBefore} layout="none">{video}</Sequence> : video}
    </AbsoluteFill>
  );
};
