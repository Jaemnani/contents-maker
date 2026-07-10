// Transition: iris — circular reveal from the center (upstream SVG clip-path, no WebGL).
import { iris } from "@remotion/transitions/iris";
import { linearTiming } from "@remotion/transitions";
import { AD_W, AD_H } from "@/lib/ad/schema";
import type { TransitionSpec } from "@/remotion/ad/types";

export const make = (durationInFrames: number, size?: { width: number; height: number }): TransitionSpec => ({
  presentation: iris({ width: size?.width ?? AD_W, height: size?.height ?? AD_H }),
  timing: linearTiming({ durationInFrames }),
});
