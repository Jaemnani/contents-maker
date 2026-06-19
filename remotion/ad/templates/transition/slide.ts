// Transition: next page slides in from the right.
import { slide } from "@remotion/transitions/slide";
import { linearTiming } from "@remotion/transitions";
import type { TransitionSpec } from "@/remotion/ad/types";

export const make = (durationInFrames: number): TransitionSpec => ({
  presentation: slide({ direction: "from-right" }),
  timing: linearTiming({ durationInFrames }),
});
