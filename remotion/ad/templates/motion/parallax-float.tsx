// Motion: parallax float — fixed overscale with a slow vertical drift and a faint
// horizontal sway (cinematic "floating camera").
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { MotionProps } from "@/remotion/ad/types";

export const Component: React.FC<MotionProps> = ({ durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const y = interpolate(frame, [0, durationInFrames], [16, -16]);
  const x = Math.sin(frame / 24) * 6;
  return <AbsoluteFill style={{ transform: `scale(1.08) translate(${x}px, ${y}px)` }}>{children}</AbsoluteFill>;
};
