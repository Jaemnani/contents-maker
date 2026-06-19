import type { CSSProperties } from "react";
import { AbsoluteFill, Img, OffthreadVideo, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import type { Composition, Stage, SourceType, AssetRef, MotionStyle, PanelStyle } from "@/lib/composition-types";
import type { Language } from "@/lib/types";
import { TOPICS } from "@/lib/render/strings";
import { assetUrl, pickText, COLORS, W, H } from "../lib/util";
import { textCss, COVER } from "../lib/style";

const hasVs = (m?: MotionStyle) => m === "kenburns-vs" || m === "spotlight-vs";
const hasKenBurns = (m?: MotionStyle) => m === "kenburns-vs" || m === "spotlight-vs";

// ---- media (image with optional Ken Burns, or video) ----
function Media({ ref_, sourceType, assetBase, kenburns }: { ref_?: AssetRef; sourceType: SourceType; assetBase: string; kenburns?: boolean }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  if (!ref_) return <div style={{ width: "100%", height: "100%", background: "#11151c" }} />;
  const url = assetUrl(assetBase, ref_.datasetPath, ref_.file);
  if (sourceType === "video") return <OffthreadVideo src={url} muted style={COVER} />;
  const scale = kenburns ? interpolate(frame, [0, durationInFrames], [1, 1.08], { extrapolateRight: "clamp" }) : 1;
  return <Img src={url} style={{ ...COVER, transform: `scale(${scale})` }} />;
}

// ---- label pill ----
function Pill({ text, style, pos }: { text?: string; style?: Stage["labelStyle"]; pos: CSSProperties }) {
  if (!text) return null;
  return (
    <div style={{ position: "absolute", ...pos, background: "rgba(8,10,22,0.62)", padding: "10px 26px", borderRadius: 9999, whiteSpace: "nowrap" }}>
      <div style={{ ...textCss(style, { font: "semibold", size: 40, color: "#fff" }) }}>{text}</div>
    </div>
  );
}

function Vs() {
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none" }}>
      <div style={{ width: 150, height: 150, borderRadius: "50%", background: COLORS.primary, border: "6px solid rgba(255,255,255,.9)", color: "#fff", fontWeight: 900, fontSize: 64, display: "flex", justifyContent: "center", alignItems: "center" }}>
        VS
      </div>
    </AbsoluteFill>
  );
}

// horizontal x position for a label per labelPos, within [left,right] bounds
function labelX(labelPos: string | undefined, left: number, right: number): CSSProperties {
  if (labelPos === "tr") return { right: W - right + 20 };
  if (labelPos === "center") return { left: (left + right) / 2, transform: "translateX(-50%)" };
  return { left: left + 20 };
}

interface LayoutProps {
  comp: Composition;
  stage: Stage;
  language: Language;
  assetBase: string;
}

// ---------- A: split ----------
function Split({ comp, stage, assetBase }: LayoutProps) {
  const kb = hasKenBurns(stage.motionStyle);
  const showLabels = stage.showLabels !== false;
  const lp = stage.labelPos ?? "tl";
  return (
    <AbsoluteFill style={{ flexDirection: "column" }}>
      <div style={{ flex: 1, overflow: "hidden" }}><Media ref_={stage.aRef} sourceType={comp.sourceType} assetBase={assetBase} kenburns={kb} /></div>
      <div style={{ height: 6, background: COLORS.empathy }} />
      <div style={{ flex: 1, overflow: "hidden" }}><Media ref_={stage.bRef} sourceType={comp.sourceType} assetBase={assetBase} kenburns={kb} /></div>
      {stage.motionStyle === "spotlight-vs" && <Spotlight />}
      {hasVs(stage.motionStyle) && <Vs />}
      {showLabels && (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          <Pill text={stage.aLabel ?? stage.aRef?.label} style={stage.labelStyle} pos={{ top: 40, ...labelX(lp, 0, W) }} />
          <Pill text={stage.bLabel ?? stage.bRef?.label} style={stage.labelStyle} pos={{ top: H / 2 + 40, ...labelX(lp, 0, W) }} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

// spotlight beats: dim the non-focused half (A beat → dim bottom, B beat → dim top)
function Spotlight() {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const aBeat = interpolate(frame, [d * 0.25, d * 0.32, d * 0.48, d * 0.55], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bBeat = interpolate(frame, [d * 0.55, d * 0.62, d * 0.78, d * 0.85], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: H / 2, width: W, height: H / 2, background: "rgba(11,18,21,0.55)", opacity: aBeat, pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H / 2, background: "rgba(11,18,21,0.55)", opacity: bBeat, pointerEvents: "none" }} />
    </>
  );
}

// ---------- B: panels over background ----------
function panelDecor(style: PanelStyle | undefined): CSSProperties {
  if (style === "square-border") return { borderRadius: 0, border: "3px solid rgba(255,255,255,.85)" };
  if (style === "rounded-flat") return { borderRadius: 48 };
  return { borderRadius: 48, boxShadow: "0 24px 60px rgba(0,0,0,.45)" }; // rounded-shadow (default)
}
function Panels({ comp, stage, assetBase }: LayoutProps) {
  const kb = hasKenBurns(stage.motionStyle);
  const showLabels = stage.showLabels !== false;
  const bg = stage.image?.ref
    ? <Img src={assetUrl(assetBase, stage.image.ref.datasetPath, stage.image.ref.file)} style={COVER} />
    : null;
  const PW = 920, PH = 760, MX = (W - PW) / 2;
  const panel = (ref_?: AssetRef, top = 0, label?: string) => (
    <div style={{ position: "absolute", left: MX, top, width: PW, height: PH, overflow: "hidden", ...panelDecor(stage.panelStyle) }}>
      <Media ref_={ref_} sourceType={comp.sourceType} assetBase={assetBase} kenburns={kb} />
      {showLabels && label && (
        <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "rgba(8,10,22,0.62)", padding: "8px 22px", borderRadius: 9999 }}>
          <div style={textCss(stage.labelStyle, { font: "semibold", size: 36, color: "#fff" })}>{label}</div>
        </div>
      )}
    </div>
  );
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg,#0b1215,#1b2735)" }}>
      {bg && <AbsoluteFill>{bg}</AbsoluteFill>}
      {panel(stage.aRef, 300, stage.aLabel ?? stage.aRef?.label)}
      {panel(stage.bRef, 1140, stage.bLabel ?? stage.bRef?.label)}
      {hasVs(stage.motionStyle) && <Vs />}
    </AbsoluteFill>
  );
}

// ---------- C: headline band + split ----------
function Headline({ comp, stage, language, assetBase }: LayoutProps) {
  const kb = hasKenBurns(stage.motionStyle);
  const showLabels = stage.showLabels !== false;
  const lp = stage.labelPos ?? "tl";
  const BAND = 300;
  const start = comp.stages.find((s) => s.id === "start");
  const headline = pickText(start?.headline, language) || pickText(TOPICS[comp.topicId]?.copy.headline, language);
  return (
    <AbsoluteFill style={{ flexDirection: "column", background: COLORS.ink }}>
      <div style={{ height: BAND, display: "flex", justifyContent: "center", alignItems: "center", padding: "0 60px" }}>
        <div style={{ ...textCss(undefined, { font: "black", size: 58, color: "#fff" }), textAlign: "center" }}>{headline}</div>
      </div>
      <div style={{ height: 6, background: COLORS.empathy }} />
      <div style={{ flex: 1, overflow: "hidden" }}><Media ref_={stage.aRef} sourceType={comp.sourceType} assetBase={assetBase} kenburns={kb} /></div>
      <div style={{ flex: 1, overflow: "hidden" }}><Media ref_={stage.bRef} sourceType={comp.sourceType} assetBase={assetBase} kenburns={kb} /></div>
      {hasVs(stage.motionStyle) && <Vs />}
      {showLabels && (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          <Pill text={stage.aLabel ?? stage.aRef?.label} style={stage.labelStyle} pos={{ top: BAND + 20, ...labelX(lp, 0, W) }} />
          <Pill text={stage.bLabel ?? stage.bRef?.label} style={stage.labelStyle} pos={{ bottom: 30, ...labelX(lp, 0, W) }} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

// ---------- slide-reveal (moving divider wipe) ----------
function SlideReveal({ comp, stage, assetBase }: LayoutProps) {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const dir = stage.revealDir ?? "v";
  const R = Math.min(0.8, Math.max(0.5, stage.revealRatio ?? 0.8));
  const p = interpolate(frame, [d * 0.3, d * 0.7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pct = R * 100 + ((1 - R) * 100 - R * 100) * p;
  const showLabels = stage.showLabels !== false;
  const clip = dir === "h" ? `inset(0 0 0 ${pct}%)` : `inset(${pct}% 0 0 0)`;
  const dividerStyle: CSSProperties =
    dir === "h"
      ? { position: "absolute", top: 0, left: `${pct}%`, width: 6, height: "100%", transform: "translateX(-3px)", background: COLORS.empathy }
      : { position: "absolute", left: 0, top: `${pct}%`, height: 6, width: "100%", transform: "translateY(-3px)", background: COLORS.empathy };
  return (
    <AbsoluteFill>
      <AbsoluteFill><Media ref_={stage.aRef} sourceType={comp.sourceType} assetBase={assetBase} /></AbsoluteFill>
      <AbsoluteFill style={{ clipPath: clip }}><Media ref_={stage.bRef} sourceType={comp.sourceType} assetBase={assetBase} /></AbsoluteFill>
      {stage.showDivider && <div style={dividerStyle} />}
      {showLabels && (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          {dir === "h" ? (
            <>
              <Pill text={stage.aLabel ?? stage.aRef?.label} style={stage.labelStyle} pos={{ top: 40, left: 40 }} />
              <Pill text={stage.bLabel ?? stage.bRef?.label} style={stage.labelStyle} pos={{ top: 40, right: 40 }} />
            </>
          ) : (
            <>
              <Pill text={stage.aLabel ?? stage.aRef?.label} style={stage.labelStyle} pos={{ top: 40, left: "50%", transform: "translateX(-50%)" }} />
              <Pill text={stage.bLabel ?? stage.bRef?.label} style={stage.labelStyle} pos={{ bottom: 40, left: "50%", transform: "translateX(-50%)" }} />
            </>
          )}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

export const Compare = ({ comp, stage, language, assetBase }: LayoutProps) => {
  if (stage.motionStyle === "slide-reveal") return <SlideReveal comp={comp} stage={stage} language={language} assetBase={assetBase} />;
  const layout = stage.layout ?? "split";
  if (layout === "panels") return <Panels comp={comp} stage={stage} language={language} assetBase={assetBase} />;
  if (layout === "headline") return <Headline comp={comp} stage={stage} language={language} assetBase={assetBase} />;
  return <Split comp={comp} stage={stage} language={language} assetBase={assetBase} />;
};
