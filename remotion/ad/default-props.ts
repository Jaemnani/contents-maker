// Dummy AdProject for Remotion Studio preview and Player fallbacks.
import type { AdProps } from "@/remotion/ad/types";
import type { AdProject } from "@/lib/ad/schema";

const project: AdProject = {
  projectId: "ad/_studio-preview",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  meta: { topic: "AI 영상 에디터", fps: 30, width: 1080, height: 1920 },
  product: {
    name: "TapNow",
    oneLiner: "탭 한 번으로 만드는 AI 숏폼",
    valueProps: ["프롬프트 없이 자동 편집", "트렌드 기반 주제 추천", "9:16 바로 출력"],
    cta: "지금 무료로 시작하기",
    brandColor: "#ff5a1f",
  },
  pages: [
    {
      id: "pg-demo-1",
      sourceType: "image",
      source: { kind: "none" },
      visualTemplateId: "fullscreen-title",
      motionTemplateId: "ken-burns-zoom",
      transitionTemplateId: "fade",
      caption: "영상 편집, 아직도\n새벽까지 하세요?",
      vo: "영상 편집, 아직도 새벽까지 하고 계세요?",
    },
    {
      id: "pg-demo-2",
      sourceType: "image",
      source: { kind: "none" },
      visualTemplateId: "ui-demo-frame",
      motionTemplateId: "shrink-into-ui",
      transitionTemplateId: "slide",
      caption: "탭 한 번이면 끝나요",
      vo: "이제 탭 한 번이면 끝나요.",
      imagePrompt: "a cozy cabin in snowy woods, cinematic",
    },
    {
      id: "pg-demo-3",
      sourceType: "image",
      source: { kind: "none" },
      visualTemplateId: "canvas-grid",
      motionTemplateId: "pan",
      transitionTemplateId: "wipe",
      caption: "변형도 한 캔버스에서",
      vo: "여러 버전을 한 캔버스에서 비교하세요.",
    },
    {
      id: "pg-demo-4",
      sourceType: "image",
      source: { kind: "none" },
      visualTemplateId: "model-selector",
      motionTemplateId: "caption-pop",
      transitionTemplateId: "zoom-blur",
      caption: "최신 모델, 골라 쓰세요",
      vo: "최신 모델을 골라 쓸 수 있어요.",
    },
  ],
  endcard: { enabled: true, templateId: "logo-cta", transitionTemplateId: "zoom-blur", durationSec: 3 },
  audio: { bgm: { kind: "none" } },
};

export const AD_DEFAULT_PROPS: AdProps = { project, assetBase: "" };
