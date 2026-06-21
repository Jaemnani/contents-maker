// Motion: gentle upward drift (parallax feel); slight overscale hides the edges.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { MotionProps } from "@/remotion/ad/types";

export const Component: React.FC<MotionProps> = ({ durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const y = interpolate(frame, [0, durationInFrames], [34, -34]);
  return <AbsoluteFill style={{ transform: `scale(1.1) translateY(${y}px)` }}>{children}</AbsoluteFill>;
};
