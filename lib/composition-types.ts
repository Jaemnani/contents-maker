// Client-safe types for the 3-stage short-video composition (start / main / end).
// A Composition is an INDEPENDENT artifact persisted at:
//   outputs/results/<sourceType>/<timestamp>/index.json
// It drives the wizard: setup -> start card -> main (A/B compare) -> end card -> render.
import type { Language } from "@/lib/types";

export type { Language };

/** Modality of the compared sources (extensible: text/audio later). */
export type SourceType = "image" | "video";

export type StageType = "start" | "main" | "end";

/** Per-stage: overlay text is sharp-rendered by us, or already baked into the AI image. */
export type StageTextMode = "overlay" | "in-image";

/** Where a stage's background image comes from. */
export type ImageSource = "template" | "ai" | "pick";

/** Main(body) comparison layout — user-selectable, previewed. */
export type MainLayout = "split" | "panels" | "headline";

/** Main(body) motion/effect style — user-selectable. */
export type MotionStyle = "none" | "divider-only" | "kenburns-vs" | "spotlight-vs";

/** Layout-B panel style — user-selectable. */
export type PanelStyle = "rounded-shadow" | "square-border" | "rounded-flat";

/** How to reconcile two video clips of different length. */
export type VideoFit = "loop" | "trim" | "freeze" | "sequential";

/** Overlay text anchor on a card. */
export type TextPos = "center" | "top" | "bottom";

/** Main(body) model-label placement — top-left / top-right / top-center of each region. */
export type LabelPos = "tl" | "tr" | "center";

/** A localized string set. At least the composition's primary language is filled. */
export interface LocalizedText {
  ko?: string;
  ja?: string;
  en?: string;
}

/** A reference to one generated asset anywhere under outputs/sources (cross-folder). */
export interface AssetRef {
  datasetPath: string; // outputs/-relative source folder (e.g. "outputs/sources/image/2026-06-04_2030")
  file: string; // folder-relative file name
  modality: SourceType;
  modelUid?: string;
  aspect?: string; // image only
  label?: string; // model label, captured at pick time
  prompt?: string; // source prompt (drives the same-prompt constraint)
  thumb?: string; // folder-relative poster/thumbnail (video); images self-thumb
}

/** A stage's background image (start/end card bg, or the optional main background). */
export interface StageImage {
  source: ImageSource;
  ref?: AssetRef; // resolved once generated-and-saved OR picked
  genModel?: string; // image-model uid (source = ai)
  genPrompt?: string;
  templateId?: string; // gradient/solid template id (source = template)
}

/** A toggleable card element (used for the end card: big logo + positioned text blocks). */
export interface CardElement {
  id: string;
  kind: "text" | "logo";
  enabled: boolean;
  pos: TextPos | { x: number; y: number };
  text?: LocalizedText; // kind = text
  size?: number; // font px (text) or logo width px (logo)
  assetPath?: string; // outputs/-relative uploaded logo (kind = logo)
}

export interface Stage {
  id: StageType;
  order: number;
  enabled: boolean;
  durationSec: number;
  textMode: StageTextMode;
  textPos?: TextPos; // default "center"
  image?: StageImage; // start/end card bg OR main background
  // start card copy
  headline?: LocalizedText;
  sub?: LocalizedText;
  // end card elements (logo + text blocks)
  elements?: CardElement[];
  // ---- main only ----
  layout?: MainLayout;
  motionStyle?: MotionStyle;
  panelStyle?: PanelStyle;
  videoFit?: VideoFit;
  bodyDurationSec?: number; // image compare default 6; video uses source length
  aRef?: AssetRef;
  bRef?: AssetRef;
  showLabels?: boolean;
  labelPos?: LabelPos;
  aLabel?: string;
  bLabel?: string;
}

/** ffmpeg render knobs. v1 is muted — no audio flags. */
export interface RenderOpts {
  preset: string; // libx264 preset, e.g. "slow"
  crf: number; // e.g. 18
  transition: string; // segment transition style id (extensible registry)
}

export interface Composition {
  compId: string; // "<sourceType>/<timestamp>"
  sourceType: SourceType;
  primaryLanguage: Language; // UI + AI-prompt default language
  renderLanguages: Language[]; // languages to export (default [primaryLanguage])
  topicId: string;
  createdAt: string;
  updatedAt: string;
  stages: Stage[];
  renderOpts: RenderOpts;
  renders?: Partial<Record<Language, string | null>>; // latest render per language (composition-relative)
  renderHistory?: RenderRecord[]; // every render, newest-first (kept across re-renders)
}

export interface RenderRecord {
  language: Language;
  path: string; // outputs/-relative mp4 path
  createdAt: string;
}

export const DEFAULT_RENDER_OPTS: RenderOpts = {
  preset: "slow",
  crf: 18,
  transition: "default", // start->main slide, main->end fade
};

export const STAGE_DEFAULT_DURATION: Record<StageType, number> = {
  start: 3,
  main: 6,
  end: 3,
};

/** Is this a card stage (start/end, needs a 시안 card image) vs the compare stage? */
export const isCardStage = (s: Stage): boolean => s.id === "start" || s.id === "end";

export const STAGE_LABELS: Record<StageType, string> = {
  start: "시작",
  main: "본론",
  end: "끝",
};

export const MAIN_LAYOUT_LABELS: Record<MainLayout, string> = {
  split: "풀블리드 분할",
  panels: "배경 위 카드",
  headline: "상단 헤드라인",
};
