// Motion (signature): starts fullscreen-zoomed, spring-shrinks to reveal the page
// layout — pairs with the "ui-demo-frame" visual (TapNow beat 1→2 move).
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { MotionProps } from "@/remotion/ad/types";

export const Component: React.FC<MotionProps> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 18, stiffness: 90 }, durationInFrames: 28 });
  const scale = interpolate(s, [0, 1], [1.9, 1]);
  return <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: "50% 42%" }}>{children}</AbsoluteFill>;
};
