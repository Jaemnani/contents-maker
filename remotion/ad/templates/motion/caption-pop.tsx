// Motion: quick settle-in of the whole page (composes with the banner's own pop).
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { MotionProps } from "@/remotion/ad/types";

export const Component: React.FC<MotionProps> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 15, stiffness: 180 }, durationInFrames: 14 });
  const scale = interpolate(s, [0, 1], [0.94, 1]);
  const opacity = interpolate(frame, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ transform: `scale(${scale})`, opacity }}>{children}</AbsoluteFill>;
};
