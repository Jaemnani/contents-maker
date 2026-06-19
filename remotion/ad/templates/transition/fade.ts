// Transition: crossfade.
import { fade } from "@remotion/transitions/fade";
import { linearTiming } from "@remotion/transitions";
import type { TransitionSpec } from "@/remotion/ad/types";

export const make = (durationInFrames: number): TransitionSpec => ({
  presentation: fade(),
  timing: linearTiming({ durationInFrames }),
});
