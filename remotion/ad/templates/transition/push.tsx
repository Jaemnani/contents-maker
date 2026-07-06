// Transition: push — the outgoing scene scales down and dims while the incoming one
// slides over it from the right (CSS only).
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { linearTiming } from "@remotion/transitions";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import type { TransitionSpec } from "@/remotion/ad/types";

const Push: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({
  children,
  presentationProgress: p,
  presentationDirection,
}) => {
  if (presentationDirection === "entering") {
    return <AbsoluteFill style={{ transform: `translateX(${interpolate(p, [0, 1], [100, 0])}%)` }}>{children}</AbsoluteFill>;
  }
  const scale = interpolate(p, [0, 1], [1, 0.88]);
  const dim = interpolate(p, [0, 1], [0, 0.4]);
  return (
    <AbsoluteFill style={{ transform: `scale(${scale})` }}>
      {children}
      <AbsoluteFill style={{ background: `rgba(0,0,0,${dim})` }} />
    </AbsoluteFill>
  );
};

const push = (): TransitionPresentation<Record<string, never>> => ({ component: Push, props: {} });

export const make = (durationInFrames: number): TransitionSpec => ({
  presentation: push(),
  timing: linearTiming({ durationInFrames }),
});
