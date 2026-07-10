// Transition: clock/radial wipe (SVG mask sweep, no WebGL).
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { linearTiming } from "@remotion/transitions";
import { AD_W, AD_H } from "@/lib/ad/schema";
import type { TransitionSpec } from "@/remotion/ad/types";

export const make = (durationInFrames: number, size?: { width: number; height: number }): TransitionSpec => ({
  presentation: clockWipe({ width: size?.width ?? AD_W, height: size?.height ?? AD_H }),
  timing: linearTiming({ durationInFrames }),
});
