// Template registry — binds metadata (meta.ts, pure data) to React components.
// BROWSER/REMOTION ONLY: server routes must import meta.ts instead (importing this
// file in an API route evaluates remotion → "React.createContext is undefined").
// Adding a template = meta entry (meta.ts) + component file + one line here.
import type {
  VisualTemplate,
  MotionTemplate,
  TransitionTemplate,
  EndcardTemplate,
} from "@/remotion/ad/types";
import {
  VISUAL_METAS,
  MOTION_METAS,
  TRANSITION_METAS,
  ENDCARD_METAS,
  DEFAULT_VISUAL,
  DEFAULT_MOTION,
  DEFAULT_TRANSITION,
} from "./meta";

import * as vFullscreenTitle from "./visual/fullscreen-title";
import * as vTalkingHead from "./visual/talking-head-caption";
import * as vUiDemoFrame from "./visual/ui-demo-frame";
import * as vCanvasGrid from "./visual/canvas-grid";
import * as vModelSelector from "./visual/model-selector";
import * as vPlainCaption from "./visual/plain-caption";
import * as vCompare2up from "./visual/compare-2up";
import * as vSplitMediaText from "./visual/split-media-text";
import * as vQuoteCard from "./visual/quote-card";
import * as vBigStat from "./visual/big-stat";
import * as mNone from "./motion/none";
import * as mKenBurns from "./motion/ken-burns-zoom";
import * as mPan from "./motion/pan";
import * as mShrinkIntoUi from "./motion/shrink-into-ui";
import * as mCaptionPop from "./motion/caption-pop";
import * as mZoomOut from "./motion/zoom-out";
import * as mDriftUp from "./motion/drift-up";
import * as mRotateIn from "./motion/rotate-in";
import * as tCut from "./transition/cut";
import * as tFade from "./transition/fade";
import * as tSlide from "./transition/slide";
import * as tWipe from "./transition/wipe";
import * as tFlip from "./transition/flip";
import * as tClockWipe from "./transition/clock-wipe";
import * as tZoomBlur from "./transition/zoom-blur";
import * as tDreamyZoom from "./transition/dreamy-zoom";
import * as eLogoBlurIn from "./endcard/logo-blur-in";
import * as eLogoCta from "./endcard/logo-cta";

export const registry: {
  visual: Record<string, VisualTemplate>;
  motion: Record<string, MotionTemplate>;
  transition: Record<string, TransitionTemplate>;
  endcard: Record<string, EndcardTemplate>;
} = {
  visual: {
    "fullscreen-title": { meta: VISUAL_METAS["fullscreen-title"], Component: vFullscreenTitle.Component },
    "talking-head-caption": { meta: VISUAL_METAS["talking-head-caption"], Component: vTalkingHead.Component },
    "ui-demo-frame": { meta: VISUAL_METAS["ui-demo-frame"], Component: vUiDemoFrame.Component },
    "canvas-grid": { meta: VISUAL_METAS["canvas-grid"], Component: vCanvasGrid.Component },
    "model-selector": { meta: VISUAL_METAS["model-selector"], Component: vModelSelector.Component },
    "plain-caption": { meta: VISUAL_METAS["plain-caption"], Component: vPlainCaption.Component },
    "compare-2up": { meta: VISUAL_METAS["compare-2up"], Component: vCompare2up.Component },
    "split-media-text": { meta: VISUAL_METAS["split-media-text"], Component: vSplitMediaText.Component },
    "quote-card": { meta: VISUAL_METAS["quote-card"], Component: vQuoteCard.Component },
    "big-stat": { meta: VISUAL_METAS["big-stat"], Component: vBigStat.Component },
  },
  motion: {
    none: { meta: MOTION_METAS["none"], Component: mNone.Component },
    "ken-burns-zoom": { meta: MOTION_METAS["ken-burns-zoom"], Component: mKenBurns.Component },
    pan: { meta: MOTION_METAS["pan"], Component: mPan.Component },
    "shrink-into-ui": { meta: MOTION_METAS["shrink-into-ui"], Component: mShrinkIntoUi.Component },
    "caption-pop": { meta: MOTION_METAS["caption-pop"], Component: mCaptionPop.Component },
    "zoom-out": { meta: MOTION_METAS["zoom-out"], Component: mZoomOut.Component },
    "drift-up": { meta: MOTION_METAS["drift-up"], Component: mDriftUp.Component },
    "rotate-in": { meta: MOTION_METAS["rotate-in"], Component: mRotateIn.Component },
  },
  transition: {
    cut: { meta: TRANSITION_METAS["cut"], make: tCut.make },
    fade: { meta: TRANSITION_METAS["fade"], make: tFade.make },
    slide: { meta: TRANSITION_METAS["slide"], make: tSlide.make },
    wipe: { meta: TRANSITION_METAS["wipe"], make: tWipe.make },
    flip: { meta: TRANSITION_METAS["flip"], make: tFlip.make },
    "clock-wipe": { meta: TRANSITION_METAS["clock-wipe"], make: tClockWipe.make },
    "zoom-blur": { meta: TRANSITION_METAS["zoom-blur"], make: tZoomBlur.make },
    "dreamy-zoom": { meta: TRANSITION_METAS["dreamy-zoom"], make: tDreamyZoom.make },
  },
  endcard: {
    "logo-blur-in": { meta: ENDCARD_METAS["logo-blur-in"], Component: eLogoBlurIn.Component },
    "logo-cta": { meta: ENDCARD_METAS["logo-cta"], Component: eLogoCta.Component },
  },
};

export const visualById = (id: string): VisualTemplate =>
  registry.visual[id] ?? registry.visual[DEFAULT_VISUAL];
export const motionById = (id: string): MotionTemplate =>
  registry.motion[id] ?? registry.motion[DEFAULT_MOTION];
/** Unknown transition ids behave as a cut (factory returns null). */
export const transitionById = (id: string): TransitionTemplate =>
  registry.transition[id] ?? registry.transition[DEFAULT_TRANSITION];
/** Unknown endcard ids coerce to logo-cta (timeline already budgets endcard frames). */
export const endcardById = (id: string): EndcardTemplate =>
  registry.endcard[id] ?? registry.endcard["logo-cta"];

// Re-exports so client components can keep importing everything from the registry.
export { catalog, transitionDurationFrames, DEFAULT_VISUAL, DEFAULT_MOTION, DEFAULT_TRANSITION } from "./meta";
