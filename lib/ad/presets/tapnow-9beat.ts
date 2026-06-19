// TapNow-reference 9-beat preset — the v1 fixed structure, demoted to a starting
// point: load → freely edit. Client-safe (no server imports).
import type { AdPage, AdProduct } from "@/lib/ad/schema";
import { newPageId } from "@/lib/ad/schema";

export const TAPNOW_PRODUCT: AdProduct = {
  name: "TapNow",
  oneLiner: "탭 한 번으로 만드는 AI 숏폼",
  valueProps: ["프롬프트 없이 자동 편집", "트렌드 기반 주제 추천", "최신 AI 모델 선택", "9:16 바로 출력"],
  cta: "지금 무료로 시작하기",
  brandColor: "#ff5a1f",
};

type Beat = Omit<AdPage, "id">;

const BEATS: Beat[] = [
  {
    sourceType: "image",
    source: { kind: "none" },
    visualTemplateId: "fullscreen-title",
    motionTemplateId: "ken-burns-zoom",
    transitionTemplateId: "fade",
    caption: "영상 편집, 아직도\n새벽까지 하세요?",
    vo: "영상 편집, 아직도 새벽까지 하고 계세요?",
    imagePrompt: "exhausted creator at a desk at night, glowing monitor, cinematic moody light, vertical 9:16",
  },
  {
    sourceType: "image",
    source: { kind: "none" },
    visualTemplateId: "ui-demo-frame",
    motionTemplateId: "shrink-into-ui",
    transitionTemplateId: "slide",
    caption: "탭 한 번이면 끝나요",
    vo: "이제 탭 한 번이면 영상이 완성돼요.",
    imagePrompt: "sleek dark video editor interface showing a vertical short being assembled, ui mockup",
  },
  {
    sourceType: "video",
    source: { kind: "none" },
    visualTemplateId: "talking-head-caption",
    motionTemplateId: "none",
    transitionTemplateId: "cut",
    caption: "진짜 아무것도 몰라도 돼요",
    vo: "편집을 전혀 몰라도 괜찮아요.",
    clipQuery: "talking head person speaking to camera",
  },
  {
    sourceType: "image",
    source: { kind: "none" },
    visualTemplateId: "canvas-grid",
    motionTemplateId: "pan",
    transitionTemplateId: "fade",
    caption: "주제만 고르면 알아서 척척",
    vo: "트렌드에서 주제만 고르면 알아서 만들어 줘요.",
    imagePrompt: "grid of trendy short-form video thumbnails, colorful, clean flat design",
  },
  {
    sourceType: "image",
    source: { kind: "none" },
    visualTemplateId: "canvas-grid",
    motionTemplateId: "pan",
    transitionTemplateId: "wipe",
    caption: "버전 비교도 한 캔버스에서",
    vo: "여러 버전을 한눈에 비교할 수 있어요.",
    imagePrompt: "design canvas with multiple variations of the same scene side by side",
  },
  {
    sourceType: "image",
    source: { kind: "none" },
    visualTemplateId: "model-selector",
    motionTemplateId: "caption-pop",
    transitionTemplateId: "fade",
    caption: "최신 모델, 골라 쓰세요",
    vo: "최신 AI 모델을 골라 쓸 수 있어요.",
    imagePrompt: "abstract neural network visualization, premium dark theme, vertical",
  },
  {
    sourceType: "image",
    source: { kind: "none" },
    visualTemplateId: "plain-caption",
    motionTemplateId: "ken-burns-zoom",
    transitionTemplateId: "cut",
    caption: "퀄리티는 이 정도",
    vo: "결과물 퀄리티는 직접 확인해 보세요.",
    imagePrompt: "stunning cinematic vertical landscape, golden hour, ultra detailed",
  },
  {
    sourceType: "video",
    source: { kind: "none" },
    visualTemplateId: "talking-head-caption",
    motionTemplateId: "none",
    transitionTemplateId: "zoom-blur",
    caption: "저는 이제 퇴근합니다",
    vo: "저는 이제 칼퇴근합니다.",
    clipQuery: "happy person closing laptop and leaving",
  },
  {
    sourceType: "image",
    source: { kind: "none" },
    visualTemplateId: "fullscreen-title",
    motionTemplateId: "caption-pop",
    transitionTemplateId: "dreamy-zoom",
    caption: "오늘부터 탭 한 번",
    vo: "오늘부터, 탭 한 번이면 충분해요.",
    imagePrompt: "single finger tapping a glowing button, dramatic light, vertical 9:16",
  },
];

export function tapnow9BeatPages(): AdPage[] {
  return BEATS.map((b) => ({ ...b, id: newPageId() }));
}
