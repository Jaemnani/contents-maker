"use client";
// Static @remotion/player import (keeps the generic component typing); loaded
// client-only via dynamic(ssr:false) from PlayerPreview.
import { useMemo } from "react";
import { Player } from "@remotion/player";
import type { AdProject } from "@/lib/ad/schema";
import { AdComposition } from "@/remotion/ad/AdComposition";
import { adTotalFrames } from "@/remotion/ad/lib/timeline";

export default function PlayerInner({
  project,
  controls = true,
  loop = true,
  autoPlay = false,
}: {
  project: AdProject;
  controls?: boolean;
  loop?: boolean;
  autoPlay?: boolean;
}) {
  const inputProps = useMemo(() => ({ project, assetBase: "" }), [project]);
  return (
    <Player
      component={AdComposition}
      inputProps={inputProps}
      durationInFrames={adTotalFrames(project)}
      compositionWidth={project.meta.width || 1080}
      compositionHeight={project.meta.height || 1920}
      fps={project.meta.fps || 30}
      style={{ width: "100%" }}
      controls={controls}
      loop={loop}
      autoPlay={autoPlay}
      numberOfSharedAudioTags={14}
      acknowledgeRemotionLicense
    />
  );
}
