// Scene transition registry → @remotion/transitions presentations + timing.
import { linearTiming, springTiming, type TransitionPresentation, type TransitionTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { iris } from "@remotion/transitions/iris";
import { dissolve } from "@remotion/transitions/dissolve";
import { zoomInOut } from "@remotion/transitions/zoom-in-out";
import { zoomBlur } from "@remotion/transitions/zoom-blur";
import { dreamyZoom } from "@remotion/transitions/dreamy-zoom";
import { filmBurn } from "@remotion/transitions/film-burn";
import { linearBlur } from "@remotion/transitions/linear-blur";
import { W, H } from "./util";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function presentationFor(id: string | undefined, boundaryIndex: number): TransitionPresentation<any> {
  switch (id) {
    case "fade": return fade();
    case "slide": return slide({ direction: "from-bottom" });
    case "wipe": return wipe({ direction: "from-bottom" });
    case "flip": return flip();
    case "clockWipe": return clockWipe({ width: W, height: H });
    case "iris": return iris({ width: W, height: H });
    case "dissolve": return dissolve({});
    case "zoomInOut": return zoomInOut({});
    case "zoomBlur": return zoomBlur({});
    case "dreamyZoom": return dreamyZoom({});
    case "filmBurn": return filmBurn({});
    case "linearBlur": return linearBlur({});
    case "default":
    default:
      // start→main slides up, later boundaries fade
      return boundaryIndex === 1 ? slide({ direction: "from-bottom" }) : fade();
  }
}

export function timingFor(kind: string | undefined, durationInFrames: number): TransitionTiming {
  return kind === "spring"
    ? springTiming({ config: { damping: 200 }, durationInFrames })
    : linearTiming({ durationInFrames });
}
