// Motion: rhythmic pulse — a subtle zoom bump about twice a second (music-video feel).
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { MotionProps } from "@/remotion/ad/types";

export const Component: React.FC<MotionProps> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beat = Math.sin((frame / fps) * Math.PI * 2 * 2); // ~120bpm feel
  const scale = 1.04 + Math.max(0, beat) * 0.035;
  return <AbsoluteFill style={{ transform: `scale(${scale})` }}>{children}</AbsoluteFill>;
};
