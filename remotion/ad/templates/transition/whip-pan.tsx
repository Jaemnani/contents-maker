// Transition: whip pan — both scenes swish left with a heavy blur burst mid-swing
// (CSS only; directional blur approximated with blur+scaleX). Fast-beat staple.
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { linearTiming } from "@remotion/transitions";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import type { TransitionSpec } from "@/remotion/ad/types";

const Whip: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({
  children,
  presentationProgress: p,
  presentationDirection,
}) => {
  const entering = presentationDirection === "entering";
  const x = entering ? interpolate(p, [0, 1], [100, 0]) : interpolate(p, [0, 1], [0, -100]);
  // blur peaks mid-transition (0 → 16px → 0) on both scenes
  const blur = interpolate(p, [0, 0.5, 1], [0, 16, 0]);
  return (
    <AbsoluteFill style={{ transform: `translateX(${x}%) scaleX(1.06)`, filter: blur > 0.5 ? `blur(${blur}px)` : undefined }}>
      {children}
    </AbsoluteFill>
  );
};

const whipPan = (): TransitionPresentation<Record<string, never>> => ({ component: Whip, props: {} });

export const make = (durationInFrames: number): TransitionSpec => ({
  presentation: whipPan(),
  timing: linearTiming({ durationInFrames }),
});
