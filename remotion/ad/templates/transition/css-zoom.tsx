// CSS-only zoom presentations (no WebGL) — replaces the @remotion/transitions
// shader presentations (zoomBlur/dreamyZoom) that require Chrome's experimental
// "HTML in Canvas" (canvas-draw-element) flag and crash the Player otherwise.
// A presentation is just a component fed (children, progress 0→1, direction).
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";

type ZoomParams = {
  /** scale at the "far" end of the move (entering starts here, exiting ends here). */
  scale: number;
  /** max blur in px at the far end. */
  blur: number;
  /** max rotation in deg at the far end (0 = no rotation). */
  rotate: number;
};

const ZoomPresentation: React.FC<TransitionPresentationComponentProps<ZoomParams>> = ({
  children,
  presentationProgress: p,
  presentationDirection,
  passedProps,
}) => {
  const entering = presentationDirection === "entering";
  // entering: far → 1 (zooms/settles in).  exiting: 1 → far (zooms/blurs out).
  const scale = entering
    ? interpolate(p, [0, 1], [passedProps.scale, 1])
    : interpolate(p, [0, 1], [1, passedProps.scale]);
  const blur = entering
    ? interpolate(p, [0, 1], [passedProps.blur, 0])
    : interpolate(p, [0, 1], [0, passedProps.blur]);
  const rotate = entering
    ? interpolate(p, [0, 1], [passedProps.rotate, 0])
    : interpolate(p, [0, 1], [0, -passedProps.rotate]);
  const opacity = entering ? p : 1 - p;
  return (
    <AbsoluteFill
      style={{
        opacity,
        filter: blur > 0.01 ? `blur(${blur}px)` : undefined,
        transform: `scale(${scale}) rotate(${rotate}deg)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Build a TransitionPresentation that crossfades two scenes with a zoom/blur move. */
export function cssZoom(params: ZoomParams): TransitionPresentation<ZoomParams> {
  return { component: ZoomPresentation, props: params };
}
