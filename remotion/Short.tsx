import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import { enabledStages, sceneFrames, transitionFrames, type ShortProps } from "./lib/util";
import { presentationFor, timingFor } from "./lib/transitions";
import { ensureFonts } from "./lib/fonts";
import { StartCard } from "./scenes/StartCard";
import { Compare } from "./scenes/Compare";
import { EndCard } from "./scenes/EndCard";

export const Short: React.FC<ShortProps> = ({ comp, language, assetBase }) => {
  ensureFonts();
  const stages = enabledStages(comp);
  const tf = transitionFrames(comp);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <TransitionSeries>
        {stages.map((s, i) => (
          <React.Fragment key={s.id}>
            {i > 0 && (
              <TransitionSeries.Transition
                presentation={presentationFor(comp.renderOpts.transition, i)}
                timing={timingFor(comp.renderOpts.transitionTiming, tf)}
              />
            )}
            <TransitionSeries.Sequence durationInFrames={sceneFrames(s)}>
              {s.id === "start" ? (
                <StartCard stage={s} language={language} assetBase={assetBase} />
              ) : s.id === "main" ? (
                <Compare comp={comp} stage={s} language={language} assetBase={assetBase} />
              ) : (
                <EndCard stage={s} language={language} assetBase={assetBase} />
              )}
            </TransitionSeries.Sequence>
          </React.Fragment>
        ))}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
