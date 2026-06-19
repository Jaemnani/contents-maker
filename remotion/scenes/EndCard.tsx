import { AbsoluteFill, Img } from "remotion";
import type { Stage } from "@/lib/composition-types";
import type { Language } from "@/lib/types";
import { pickText, pathUrl } from "../lib/util";
import { CardBg } from "../components/CardBg";
import { StyledText } from "../components/StyledText";
import { isLightTemplate, justifyFor } from "../lib/style";

export const EndCard = ({ stage, language, assetBase }: { stage: Stage; language: Language; assetBase: string }) => {
  const overlay = stage.textMode !== "in-image";
  const onImage = (stage.image?.source === "ai" || stage.image?.source === "pick") && !!stage.image?.ref;
  const light = isLightTemplate(stage.image?.templateId) && stage.image?.source === "template";
  const fg = light ? "#0b1215" : "#ffffff";
  const els = (stage.elements ?? []).filter((e) => e.enabled);
  const logo = els.find((e) => e.kind === "logo" && e.assetPath);
  const texts = els.filter((e) => e.kind === "text");
  return (
    <AbsoluteFill>
      <CardBg stage={stage} assetBase={assetBase} dim={onImage && overlay} />
      {overlay && (
        <>
          {logo && (
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
              <Img src={pathUrl(assetBase, logo.assetPath!)} style={{ width: logo.size ?? 720, objectFit: "contain" }} />
            </AbsoluteFill>
          )}
          <AbsoluteFill style={{ justifyContent: justifyFor(stage.textPos), alignItems: "center", padding: "150px 70px", gap: 24 }}>
            {texts.map((el, i) => (
              <StyledText
                key={el.id}
                text={pickText(el.text, language)}
                style={el.style}
                def={{ font: "black", size: el.size ?? 64, color: fg }}
                delay={i * 6}
              />
            ))}
          </AbsoluteFill>
        </>
      )}
    </AbsoluteFill>
  );
};
