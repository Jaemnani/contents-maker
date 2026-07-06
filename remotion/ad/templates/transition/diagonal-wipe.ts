// Transition: diagonal wipe — reveal sweeping from the top-left corner.
import { wipe } from "@remotion/transitions/wipe";
import { linearTiming } from "@remotion/transitions";
import type { TransitionSpec } from "@/remotion/ad/types";

export const make = (durationInFrames: number): TransitionSpec => ({
  presentation: wipe({ direction: "from-top-left" }),
  timing: linearTiming({ durationInFrames }),
});
