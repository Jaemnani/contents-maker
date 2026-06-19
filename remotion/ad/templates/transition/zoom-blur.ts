// Transition: punchy zoom-blur burst (CSS, no WebGL) — great right before the endcard.
// Was @remotion/transitions/zoom-blur (shader) — that needs Chrome's experimental
// HTML-in-Canvas flag and crashes the Player; cssZoom is a portable equivalent.
import { linearTiming } from "@remotion/transitions";
import { cssZoom } from "./css-zoom";
import type { TransitionSpec } from "@/remotion/ad/types";

export const make = (durationInFrames: number): TransitionSpec => ({
  presentation: cssZoom({ scale: 1.6, blur: 24, rotate: 0 }),
  timing: linearTiming({ durationInFrames }),
});
