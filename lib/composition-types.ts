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

/** Main(body) motion/effect style — user-selectable.
 *  slide-reveal: full-frame A/B with a horizontal divider that slides over time
 *  (emphasize A, then B). Split layout only; uses `revealRatio`. */
export type MotionStyle = "none" | "divider-only" | "kenburns-vs" | "spotlight-vs" | "slide-reveal";

/** Layout-B panel style — user-selectable. */
export type PanelStyle = "rounded-shadow" | "square-border" | "rounded-flat";

/** Slide-reveal direction: vertical (top/bottom) or horizontal (left/right). */
export type RevealDir = "v" | "h";

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

/** Per-text styling for overlay text (cards, labels). */
export type FontKey = "black" | "semibold" | "bebas";
export type TextEffect = "shadow" | "outline" | "glow" | "plain";
export interface TextStyle {
  font?: FontKey;
  size?: number;
  color?: string; // hex, e.g. "#ffffff"
  effect?: TextEffect;
}

export const FONT_LABELS: Record<FontKey, string> = {
  black: "Pretendard Black",
  semibold: "Pretendard SemiBold",
  bebas: "Bebas Neue",
};
export const EFFECT_LABELS: Record<TextEffect, string> = {
  shadow: "그림자",
  outline: "외곽선",
  glow: "글로우",
  plain: "없음",
};

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
  style?: TextStyle; // kind = text — font/effect/color (size falls back to `size`)
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
  headlineStyle?: TextStyle;
  subStyle?: TextStyle;
  // end card elements (logo + text blocks)
  elements?: CardElement[];
  // ---- main only ----
  layout?: MainLayout;
  motionStyle?: MotionStyle;
  revealRatio?: number; // slide-reveal: A's max share (0.8=8:2 … 0.5=5:5/static)
  revealDir?: RevealDir; // slide-reveal direction (default "v")
  showDivider?: boolean; // slide-reveal: draw the moving boundary line
  panelStyle?: PanelStyle;
  videoFit?: VideoFit;
  bodyDurationSec?: number; // image compare default 6; video uses source length
  aRef?: AssetRef;
  bRef?: AssetRef;
  showLabels?: boolean;
  labelPos?: LabelPos;
  labelStyle?: TextStyle;
  aLabel?: string;
  bLabel?: string;
}

/** Scene transition presets (Remotion @remotion/transitions). */
export type TransitionPreset =
  | "default"
  | "fade"
  | "slide"
  | "wipe"
  | "flip"
  | "clockWipe"
  | "iris"
  | "dissolve"
  | "zoomInOut"
  | "zoomBlur"
  | "dreamyZoom"
  | "filmBurn"
  | "linearBlur";

export const TRANSITION_LABELS: Record<TransitionPreset, string> = {
  default: "기본(슬라이드→페이드)",
  fade: "페이드",
  slide: "슬라이드",
  wipe: "와이프",
  flip: "플립",
  clockWipe: "시계 와이프",
  iris: "아이리스(원형)",
  dissolve: "디졸브",
  zoomInOut: "줌 인/아웃",
  zoomBlur: "줌 블러",
  dreamyZoom: "드리미 줌",
  filmBurn: "필름 번",
  linearBlur: "리니어 블러",
};

/** Render knobs. v1 is muted. */
export interface RenderOpts {
  preset: string; // libx264 preset, e.g. "slow"
  crf: number; // e.g. 18
  transition: string; // TransitionPreset id (global, applied to scene boundaries)
  transitionTiming?: "linear" | "spring";
  transitionDurationSec?: number; // default 0.4
}

export interface Composition {
  compId: string; // "<sourceType>/<timestamp>"
  sourceType: SourceType;
  primaryLanguage: Language; // UI + AI-prompt default language
  renderLanguages: Language[]; // languages to export (default [primaryLanguage])
  topicId: string; // start/end card TEMPLATE id (stays a real TOPICS id; never overwritten by a recommendation)
  topicTitle?: string; // display-only subject label for the recent list (from a recommended topic); independent of topicId
  comparePrompt?: string; // suggested prompt to feed both models in the MAIN comparison pair (from trend curation)
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
