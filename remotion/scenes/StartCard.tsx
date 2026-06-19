import { AbsoluteFill } from "remotion";
import type { Stage } from "@/lib/composition-types";
import type { Language } from "@/lib/types";
import { pickText } from "../lib/util";
import { CardBg } from "../components/CardBg";
import { StyledText } from "../components/StyledText";
import { isLightTemplate, justifyFor } from "../lib/style";

export const StartCard = ({ stage, language, assetBase }: { stage: Stage; language: Language; assetBase: string }) => {
  const overlay = stage.textMode !== "in-image";
  const onImage = (stage.image?.source === "ai" || stage.image?.source === "pick") && !!stage.image?.ref;
  const light = isLightTemplate(stage.image?.templateId) && stage.image?.source === "template";
  const fg = light ? "#0b1215" : "#ffffff";
  const headline = pickText(stage.headline, language);
  const sub = pickText(stage.sub, language);
  return (
    <AbsoluteFill>
      <CardBg stage={stage} assetBase={assetBase} dim={onImage && overlay} />
      {overlay && (
        <AbsoluteFill style={{ justifyContent: justifyFor(stage.textPos), alignItems: "center", padding: "200px 70px" }}>
          <div style={{ textAlign: "center" }}>
            <StyledText text={headline} style={stage.headlineStyle} def={{ font: "black", size: 92, color: fg }} />
            {sub && (
              <div style={{ marginTop: 26 }}>
                <StyledText text={sub} style={stage.subStyle} def={{ font: "semibold", size: 44, color: fg }} delay={8} />
              </div>
            )}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
