// Transition: dreamy rotating zoom (CSS, no WebGL).
// Was @remotion/transitions/dreamy-zoom (shader) — that needs Chrome's experimental
// HTML-in-Canvas flag and crashes the Player; cssZoom is a portable equivalent.
import { linearTiming } from "@remotion/transitions";
import { cssZoom } from "./css-zoom";
import type { TransitionSpec } from "@/remotion/ad/types";

export const make = (durationInFrames: number): TransitionSpec => ({
  presentation: cssZoom({ scale: 1.15, blur: 14, rotate: 6 }),
  timing: linearTiming({ durationInFrames }),
});
