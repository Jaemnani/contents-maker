// Motion: subtle rotate + settle on entrance (overscale avoids corner gaps).
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { MotionProps } from "@/remotion/ad/types";

export const Component: React.FC<MotionProps> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 16, stiffness: 120 }, durationInFrames: 22 });
  const rotate = interpolate(s, [0, 1], [-5, 0]);
  const scale = interpolate(s, [0, 1], [1.14, 1.05]);
  return <AbsoluteFill style={{ transform: `rotate(${rotate}deg) scale(${scale})` }}>{children}</AbsoluteFill>;
};
