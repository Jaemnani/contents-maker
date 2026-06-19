// Minimal sample props so Remotion Studio can preview without real data.
import type { Composition } from "@/lib/composition-types";
import type { ShortProps } from "./util";

const sampleComp: Composition = {
  compId: "image/preview",
  sourceType: "image",
  primaryLanguage: "ko",
  renderLanguages: ["ko"],
  topicId: "same-prompt-different-ai",
  createdAt: "",
  updatedAt: "",
  renderOpts: { preset: "slow", crf: 18, transition: "default" },
  stages: [
    {
      id: "start",
      order: 0,
      enabled: true,
      durationSec: 3,
      textMode: "overlay",
      textPos: "center",
      headline: { ko: "같은 프롬프트 다른 AI" },
      sub: { ko: "어느쪽이 더 좋아?" },
    },
    {
      id: "main",
      order: 1,
      enabled: true,
      durationSec: 6,
      textMode: "overlay",
      layout: "split",
      motionStyle: "kenburns-vs",
      bodyDurationSec: 6,
      showLabels: true,
      aLabel: "Model A",
      bLabel: "Model B",
    },
    {
      id: "end",
      order: 2,
      enabled: true,
      durationSec: 3,
      textMode: "overlay",
      elements: [{ id: "cta", kind: "text", enabled: true, pos: "center", text: { ko: "댓글로 골라줘!" }, size: 64 }],
    },
  ],
};

export const DEFAULT_PROPS: ShortProps = {
  comp: sampleComp,
  language: "ko",
  assetBase: "",
};
