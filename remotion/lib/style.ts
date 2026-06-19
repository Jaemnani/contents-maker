// TextStyle → CSS, and card background helpers, for the Remotion scenes.
import type { CSSProperties } from "react";
import type { TextStyle, FontKey, TextPos } from "@/lib/composition-types";
import { cardTemplate } from "@/lib/render/strings";

const FONT: Record<FontKey, { family: string; weight: number }> = {
  black: { family: "Pretendard", weight: 900 },
  semibold: { family: "Pretendard", weight: 600 },
  bebas: { family: "Bebas Neue", weight: 400 },
};

export interface TextDefaults {
  font: FontKey;
  size: number;
  color: string;
}

function outlineShadow(t: number, c: string): string {
  return [
    `${t}px 0 ${c}`, `-${t}px 0 ${c}`, `0 ${t}px ${c}`, `0 -${t}px ${c}`,
    `${t}px ${t}px ${c}`, `-${t}px ${t}px ${c}`, `${t}px -${t}px ${c}`, `-${t}px -${t}px ${c}`,
  ].join(", ");
}

export function textCss(style: TextStyle | undefined, def: TextDefaults): CSSProperties {
  const f = FONT[style?.font ?? def.font];
  const size = style?.size ?? def.size;
  const color = style?.color ?? def.color;
  const effect = style?.effect ?? "shadow";
  const css: CSSProperties = {
    fontFamily: `'${f.family}', system-ui, sans-serif`,
    fontWeight: f.weight,
    fontSize: size,
    color,
    lineHeight: 1.12,
    whiteSpace: "pre-line",
    margin: 0,
  };
  if (effect === "shadow") css.textShadow = "0 4px 18px rgba(0,0,0,0.55)";
  else if (effect === "glow") css.textShadow = `0 0 ${Math.round(size * 0.18)}px ${color}, 0 0 ${Math.round(size * 0.34)}px ${color}`;
  else if (effect === "outline") css.textShadow = outlineShadow(Math.max(2, Math.round(size / 22)), "#0b1215");
  return css;
}

/** Full-frame CSS background for a card template id (gradient or solid). */
export function templateBackground(id: string | undefined): string {
  const t = cardTemplate(id);
  return t.kind === "gradient" && t.to ? `linear-gradient(180deg, ${t.from}, ${t.to})` : t.from;
}

export const isLightTemplate = (id: string | undefined) => id === "light" || id === "canvas";

export const justifyFor = (pos?: TextPos): CSSProperties["justifyContent"] =>
  pos === "top" ? "flex-start" : pos === "bottom" ? "flex-end" : "center";

export const COVER: CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
