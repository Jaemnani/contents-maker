// Ad template system types. Browser-safe (used by the Player, the UI and the LLM catalog).
import type React from "react";
import type { TransitionPresentation } from "@remotion/transitions";
import type { TransitionTiming } from "@remotion/transitions";
import type { AdPage, AdProduct, AdProject, AdEndcard } from "@/lib/ad/schema";

export type TemplateCategory = "visual" | "motion" | "transition" | "endcard";

export interface TemplateMeta {
  id: string;
  category: TemplateCategory;
  name: string; // UI label (plain Korean)
  describe: string; // one-liner for the LLM compose prompt (English)
  hint?: string; // Korean one-liner shown in the UI — what it looks like / when to use
  thumbnail?: string;
  /** visual/motion only — which page source types this template works with. */
  compatibleSourceTypes?: ("image" | "video")[];
  /** visual only — the media slots this layout fills, with UI labels (default: one slot). */
  sourceSlots?: { key: "A" | "B" | "C" | "D"; label: string }[];
  /** visual only — shows a big title (page.caption) whose vertical position is adjustable. */
  hasTitle?: boolean;
  /** fallback page length when there is no VO and no override. */
  defaultDurationSec?: number;
  /** transition only — series overlap length. */
  durationFrames?: number;
}

export interface VisualProps {
  page: AdPage;
  product: AdProduct;
  assetBase: string;
}

export interface MotionProps {
  page: AdPage;
  durationInFrames: number;
  children: React.ReactNode;
}

export interface EndcardProps {
  endcard: AdEndcard;
  product: AdProduct;
  assetBase: string;
}

/** null = hard cut (no <TransitionSeries.Transition> inserted). */
export type TransitionSpec = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  presentation: TransitionPresentation<any>;
  timing: TransitionTiming;
} | null;

export interface VisualTemplate {
  meta: TemplateMeta;
  Component: React.FC<VisualProps>;
}
export interface MotionTemplate {
  meta: TemplateMeta;
  Component: React.FC<MotionProps>;
}
export interface TransitionTemplate {
  meta: TemplateMeta;
  make: (durationInFrames: number) => TransitionSpec;
}
export interface EndcardTemplate {
  meta: TemplateMeta;
  Component: React.FC<EndcardProps>;
}

export interface AdProps extends Record<string, unknown> {
  project: AdProject;
  assetBase: string; // "" in the Player (relative /api/file), origin URL in server renders
}
