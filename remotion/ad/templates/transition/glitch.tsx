// Transition: digital glitch — the entering scene appears through RGB-split ghosts and
// horizontally-offset slice bands. Deterministic (frame-quantized seeds, no Math.random).
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { linearTiming } from "@remotion/transitions";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import type { TransitionSpec } from "@/remotion/ad/types";

/** deterministic pseudo-random in [-1, 1] */
const rnd = (a: number, b: number) => {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

const SLICES = 6;

const Glitch: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({
  children,
  presentationProgress: p,
  presentationDirection,
}) => {
  const entering = presentationDirection === "entering";
  // time quantized into steps so the glitch "jumps" instead of sliding smoothly
  const step = Math.floor(p * 9);
  // glitch intensity ramps up then vanishes (entering resolves clean; exiting degrades)
  const amp = entering ? interpolate(p, [0, 0.55, 1], [0, 22, 0]) : interpolate(p, [0, 0.6, 1], [0, 18, 26]);
  const opacity = entering ? interpolate(p, [0, 0.35], [0, 1], { extrapolateRight: "clamp" }) : interpolate(p, [0.65, 1], [1, 0], { extrapolateLeft: "clamp" });
  const rgb = amp * 0.35;
  return (
    <AbsoluteFill style={{ opacity }}>
      {/* RGB ghost layers */}
      <AbsoluteFill style={{ transform: `translateX(${rgb}px)`, filter: "saturate(2)", opacity: amp > 1 ? 0.5 : 0, mixBlendMode: "screen" }}>
        {children}
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: `translateX(${-rgb}px)`, filter: "hue-rotate(180deg) saturate(2)", opacity: amp > 1 ? 0.35 : 0, mixBlendMode: "screen" }}>
        {children}
      </AbsoluteFill>
      {/* sliced base layer — each horizontal band offset by a quantized jitter */}
      {Array.from({ length: SLICES }, (_, i) => {
        const top = (i / SLICES) * 100;
        const bottom = 100 - ((i + 1) / SLICES) * 100;
        const dx = rnd(step, i) * amp;
        return (
          <AbsoluteFill key={i} style={{ clipPath: `inset(${top}% 0 ${bottom}% 0)`, transform: `translateX(${dx}px)` }}>
            {children}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

const glitch = (): TransitionPresentation<Record<string, never>> => ({ component: Glitch, props: {} });

export const make = (durationInFrames: number): TransitionSpec => ({
  presentation: glitch(),
  timing: linearTiming({ durationInFrames }),
});
