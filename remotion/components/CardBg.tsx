import { AbsoluteFill, Img } from "remotion";
import type { Stage } from "@/lib/composition-types";
import { assetUrl } from "../lib/util";
import { templateBackground, COVER } from "../lib/style";

/** Card background: template gradient/solid, or a cover image (ai/pick) with optional scrim. */
export const CardBg = ({ stage, assetBase, dim }: { stage: Stage; assetBase: string; dim?: boolean }) => {
  const img = stage.image;
  if (img && (img.source === "ai" || img.source === "pick") && img.ref) {
    return (
      <AbsoluteFill>
        <Img src={assetUrl(assetBase, img.ref.datasetPath, img.ref.file)} style={COVER} />
        {dim && <AbsoluteFill style={{ background: "rgba(11,18,21,0.5)" }} />}
      </AbsoluteFill>
    );
  }
  return <AbsoluteFill style={{ background: templateBackground(img?.templateId) }} />;
};
