// Dynamic page-assembly composition: pages[] → TransitionSeries, with two audio
// lanes OUTSIDE the series (VO sequences + ducked BGM) so transitions never touch audio.
import React, { Fragment } from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import type { AdProps } from "@/remotion/ad/types";
import type { AdPage, AdProject } from "@/lib/ad/schema";
import { ensureFonts } from "@/remotion/lib/fonts";
import { COLORS, pathUrl } from "@/remotion/lib/util";
import { visualById, motionById, transitionById, endcardById } from "@/remotion/ad/templates/registry";
import {
  pageFrames,
  pageOffsets,
  transitionFramesAt,
  endcardFrames,
  voIntervals,
  bgmVolumeAt,
  videoStartFrames,
  videoSourceKey,
  adTotalFrames,
  voSpeedOf,
} from "@/remotion/ad/lib/timeline";
import { MediaStartContext } from "@/remotion/ad/components/SourceLayer";
import { transitionWhoosh, pageDing, DEFAULT_SFX_VOLUME } from "@/remotion/ad/lib/sfx";
import { AudioEnvContext } from "@/remotion/ad/lib/audio-env";

function bgmSrc(project: AdProject, assetBase: string): string | null {
  const bgm = project.audio.bgm;
  if (bgm.kind === "library") return staticFile(`bgm/${bgm.file}`);
  if (bgm.kind === "upload") return pathUrl(assetBase, bgm.path);
  return null;
}

const PageScene: React.FC<{ page: AdPage; project: AdProject; assetBase: string; frames: number; mediaStart: number }> = ({
  page,
  project,
  assetBase,
  frames,
  mediaStart,
}) => {
  const Visual = visualById(page.visualTemplateId).Component;
  const Motion = motionById(page.motionTemplateId).Component;
  const ctx = React.useMemo(
    () => ({ frames: mediaStart, key: videoSourceKey(page.source) }),
    [mediaStart, page.source]
  );
  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      {/* same-source consecutive pages resume the PRIMARY video from where the last left off */}
      <MediaStartContext.Provider value={ctx}>
        <Motion page={page} durationInFrames={frames}>
          <Visual page={page} product={project.product} assetBase={assetBase} />
        </Motion>
      </MediaStartContext.Provider>
    </AbsoluteFill>
  );
};

export const AdComposition: React.FC<AdProps> = ({ project, assetBase }) => {
  ensureFonts();
  const fps = project.meta.fps || 30;
  const pages = project.pages;
  const offsets = pageOffsets(project);
  const voSpeed = voSpeedOf(project);
  const vStarts = videoStartFrames(project);
  const intervals = voIntervals(project);
  const ecFrames = endcardFrames(project);
  const Endcard = project.endcard.enabled ? endcardById(project.endcard.templateId) : undefined;

  if (pages.length === 0 && !Endcard) {
    return (
      <AbsoluteFill style={{ background: COLORS.ink, justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Pretendard", fontWeight: 600, fontSize: 44 }}>
          페이지를 추가하세요
        </div>
      </AbsoluteFill>
    );
  }

  const src = bgmSrc(project, assetBase);
  return (
    <AudioEnvContext.Provider value={{ voSpeed }}>
    <AbsoluteFill style={{ background: COLORS.ink }}>
      {/* audio lane 1: VO — sequenced at page starts, full VO length (may bleed past a shortened page) */}
      {pages.map((p, i) =>
        p.voAudio ? (
          <Sequence key={`vo-${p.id}`} from={offsets[i]} durationInFrames={Math.ceil((p.voAudio.durationSec / voSpeed) * fps)}>
            <Audio src={pathUrl(assetBase, p.voAudio.path)} playbackRate={voSpeed} />
          </Sequence>
        ) : null
      )}
      {project.endcard.enabled && project.endcard.voAudio && (
        <Sequence
          from={adTotalFrames(project) - ecFrames}
          durationInFrames={Math.ceil((project.endcard.voAudio.durationSec / voSpeed) * fps)}
        >
          <Audio src={pathUrl(assetBase, project.endcard.voAudio.path)} playbackRate={voSpeed} />
        </Sequence>
      )}
      {/* audio lane 2: BGM — looped, ducked under VO. loopVolumeCurveBehavior="extend"
          keeps the volume callback on ABSOLUTE frames (default "repeat" restarts the
          curve every loop iteration → ducking would misalign once the track loops). */}
      {src && (
        <Audio
          loop
          loopVolumeCurveBehavior="extend"
          src={src}
          volume={(f) =>
            bgmVolumeAt(f, intervals, { base: project.audio.baseVolume, ducked: project.audio.duckVolume })
          }
        />
      )}

      {/* audio lane 3: SFX — transition whooshes + entrance dings (opt-in) */}
      {project.audio.sfxEnabled &&
        pages.map((p, i) => {
          const sfxVol = project.audio.sfxVolume ?? DEFAULT_SFX_VOLUME;
          const isLast = i === pages.length - 1;
          const transId = isLast && project.endcard.enabled ? project.endcard.transitionTemplateId : p.transitionTemplateId;
          const transFrames = transitionFramesAt(project, i);
          // the overlap with the NEXT scene starts where that scene starts
          const transStart = isLast ? adTotalFrames(project) - ecFrames : offsets[i + 1] ?? null;
          const whoosh = transFrames > 0 && transStart != null && transitionWhoosh(transId);
          const ding = pageDing(p);
          return (
            <Fragment key={`sfx-${p.id}`}>
              {whoosh && (
                <Sequence from={Math.max(0, transStart - 3)} durationInFrames={40}>
                  <Audio src={staticFile("sfx/whoosh.wav")} volume={sfxVol} />
                </Sequence>
              )}
              {ding && (
                <Sequence from={offsets[i] + 2} durationInFrames={30}>
                  <Audio src={staticFile("sfx/ding.wav")} volume={sfxVol} />
                </Sequence>
              )}
            </Fragment>
          );
        })}

      <TransitionSeries>
        {pages.map((p, i) => {
          const frames = pageFrames(p, fps, voSpeed);
          const transFrames = transitionFramesAt(project, i);
          // last page exits via the ENDCARD's configured transition (when endcard is on)
          const transId =
            i === pages.length - 1 && project.endcard.enabled
              ? project.endcard.transitionTemplateId
              : p.transitionTemplateId;
          const spec = transFrames > 0
            ? transitionById(transId).make(transFrames, { width: project.meta.width || 1080, height: project.meta.height || 1920 })
            : null;
          return (
            <Fragment key={p.id}>
              <TransitionSeries.Sequence durationInFrames={frames}>
                <PageScene page={p} project={project} assetBase={assetBase} frames={frames} mediaStart={vStarts[i]} />
              </TransitionSeries.Sequence>
              {spec && (
                <TransitionSeries.Transition presentation={spec.presentation} timing={spec.timing} />
              )}
            </Fragment>
          );
        })}
        {Endcard && (
          <TransitionSeries.Sequence durationInFrames={ecFrames}>
            <Endcard.Component endcard={project.endcard} product={project.product} assetBase={assetBase} />
          </TransitionSeries.Sequence>
        )}
      </TransitionSeries>
    </AbsoluteFill>
    </AudioEnvContext.Provider>
  );
};
