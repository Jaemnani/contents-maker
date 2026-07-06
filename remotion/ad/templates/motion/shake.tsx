// Motion: impact shake — strong deterministic jitter that decays over the first ~14
// frames, then holds still. Pairs with hook pages / big claims.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { MotionProps } from "@/remotion/ad/types";

const rnd = (a: number, b: number) => {
  const x = Math.sin(a * 91.17 + b * 41.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

export const Component: React.FC<MotionProps> = ({ children }) => {
  const frame = useCurrentFrame();
  const amp = interpolate(frame, [0, 14], [14, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const x = rnd(frame, 1) * amp;
  const y = rnd(frame, 2) * amp;
  const rot = rnd(frame, 3) * amp * 0.12;
  // slight overscale hides the edges the jitter would otherwise reveal
  return <AbsoluteFill style={{ transform: `scale(1.06) translate(${x}px, ${y}px) rotate(${rot}deg)` }}>{children}</AbsoluteFill>;
};
