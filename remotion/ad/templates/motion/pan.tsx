// Motion: horizontal pan across a still (canvas/gallery feel, TapNow beat 5).
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { MotionProps } from "@/remotion/ad/types";

export const Component: React.FC<MotionProps> = ({ durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, durationInFrames], [2, -2]); // percent
  return (
    <AbsoluteFill style={{ transform: `scale(1.08) translateX(${x}%)` }}>{children}</AbsoluteFill>
  );
};
