import { Composition } from "remotion";
import { Short } from "./Short";
import { FPS, W, H, totalFrames } from "./lib/util";
import { DEFAULT_PROPS } from "./lib/default-props";
import { AdComposition } from "./ad/AdComposition";
import { AD_DEFAULT_PROPS } from "./ad/default-props";
import { adTotalFrames } from "./ad/lib/timeline";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="Short"
        component={Short}
        fps={FPS}
        width={W}
        height={H}
        durationInFrames={Math.max(1, totalFrames(DEFAULT_PROPS.comp))}
        defaultProps={DEFAULT_PROPS}
        calculateMetadata={({ props }) => ({ durationInFrames: totalFrames(props.comp) })}
      />
      <Composition
        id="Ad"
        component={AdComposition}
        fps={FPS}
        width={W}
        height={H}
        durationInFrames={Math.max(1, adTotalFrames(AD_DEFAULT_PROPS.project))}
        defaultProps={AD_DEFAULT_PROPS}
        calculateMetadata={({ props }) => ({
          durationInFrames: adTotalFrames(props.project),
          // honor per-project meta so render matches the Player preview (timeline math uses meta.fps)
          fps: props.project.meta.fps || FPS,
          width: props.project.meta.width || W,
          height: props.project.meta.height || H,
        })}
      />
    </>
  );
};
