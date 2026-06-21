// Motion: slow zoom-OUT (starts pushed in, pulls back to reveal).
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { MotionProps } from "@/remotion/ad/types";

export const Component: React.FC<MotionProps> = ({ durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, durationInFrames], [1.14, 1]);
  return <AbsoluteFill style={{ transform: `scale(${scale})` }}>{children}</AbsoluteFill>;
};
