// Transition: 3D card flip (CSS-based, no WebGL).
import { flip } from "@remotion/transitions/flip";
import { linearTiming } from "@remotion/transitions";
import type { TransitionSpec } from "@/remotion/ad/types";

export const make = (durationInFrames: number): TransitionSpec => ({
  presentation: flip(),
  timing: linearTiming({ durationInFrames }),
});
