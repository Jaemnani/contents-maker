// Motion: whip zoom-in — snaps from 1.35x down to rest in ~10 frames. Attention hook
// for the FIRST page (fast start retains viewers).
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { MotionProps } from "@/remotion/ad/types";

export const Component: React.FC<MotionProps> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 20, stiffness: 260 }, durationInFrames: 12 });
  const scale = interpolate(s, [0, 1], [1.35, 1]);
  const blur = interpolate(s, [0, 1], [6, 0]);
  return <AbsoluteFill style={{ transform: `scale(${scale})`, filter: blur > 0.5 ? `blur(${blur}px)` : undefined }}>{children}</AbsoluteFill>;
};
