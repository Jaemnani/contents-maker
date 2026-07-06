// Transition: spin zoom — hard rotating zoom burst (CSS; a much stronger variant than
// dreamy-zoom's gentle {1.15, 14, 6}).
import { linearTiming } from "@remotion/transitions";
import { cssZoom } from "./css-zoom";
import type { TransitionSpec } from "@/remotion/ad/types";

export const make = (durationInFrames: number): TransitionSpec => ({
  presentation: cssZoom({ scale: 1.65, blur: 8, rotate: 28 }),
  timing: linearTiming({ durationInFrames }),
});
