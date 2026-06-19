// Shared helpers for the Remotion compositions (browser-safe; no server-only imports).
import { staticFile } from "remotion";
import type { Composition, Stage, LocalizedText } from "@/lib/composition-types";
import type { Language } from "@/lib/types";

export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const TRANS_FRAMES = Math.round(0.4 * FPS); // 12

export const COLORS = {
  ink: "#0b1215",
  canvas: "#fafaf6",
  empathy: "#007bff",
  primary: "#0067b7",
  accent: "#ffe066",
  white: "#ffffff",
};

// Must be a `type` (not `interface`) so it satisfies Remotion's `Record<string, unknown>` props.
export type ShortProps = {
  comp: Composition;
  language: Language;
  assetBase: string; // e.g. http://127.0.0.1:3000
};

export function pickText(t: LocalizedText | undefined, lang: Language): string {
  if (!t) return "";
  return t[lang] ?? t.ko ?? t.en ?? t.ja ?? "";
}

export function enabledStages(comp: Composition): Stage[] {
  return comp.stages.filter((s) => s.enabled).sort((a, b) => a.order - b.order);
}

export function sceneFrames(s: Stage): number {
  if (s.id === "main") return Math.max(1, Math.round((s.bodyDurationSec ?? s.durationSec ?? 6) * FPS));
  return Math.max(1, Math.round((s.durationSec ?? 3) * FPS));
}

/** Transition length in frames (from renderOpts.transitionDurationSec, default 0.4s). */
export function transitionFrames(comp: Composition): number {
  return Math.max(1, Math.round((comp.renderOpts?.transitionDurationSec ?? 0.4) * FPS));
}

/** Total timeline = Σ scene frames − overlapping transitions. */
export function totalFrames(comp: Composition): number {
  const ss = enabledStages(comp);
  const sum = ss.reduce((a, s) => a + sceneFrames(s), 0);
  return Math.max(1, sum - Math.max(0, ss.length - 1) * transitionFrames(comp));
}

/** outputs/-relative path → in-app file URL reachable by the render browser. */
export function pathUrl(assetBase: string, outputsRelPath: string): string {
  return `${assetBase}/api/file?path=${encodeURIComponent(outputsRelPath)}`;
}
export function assetUrl(assetBase: string, datasetPath: string, file: string): string {
  return pathUrl(assetBase, `${datasetPath}/${file}`);
}

/** Brand logo URL: the product's uploaded logo if set, else the bundled default. */
export function logoUrl(assetBase: string, logoPath?: string): string {
  return logoPath ? pathUrl(assetBase, logoPath) : staticFile("brand/logo.png");
}
