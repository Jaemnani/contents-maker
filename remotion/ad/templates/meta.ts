// Template METADATA only — pure data, no React/remotion imports, so SERVER code
// (LLM compose, timeline math in API routes) can import it safely. Components are
// bound in registry.ts (browser/Remotion contexts only).
// Adding a template = add its meta here + its component file + one registry line.
import type { TemplateMeta } from "@/remotion/ad/types";

export const VISUAL_METAS: Record<string, TemplateMeta> = {
  "fullscreen-title": {
    id: "fullscreen-title",
    category: "visual",
    name: "제목 강조 (꽉 찬 배경)",
    describe: "Full-bleed media with a big title — strong hook/opening page.",
    hint: "배경이 화면을 꽉 채우고 큰 제목. 제목 위치(상/중/하) 조절 가능. 도입/후킹에 좋아요.",
    compatibleSourceTypes: ["image", "video"],
    hasTitle: true,
    defaultDurationSec: 3,
  },
  "talking-head-caption": {
    id: "talking-head-caption",
    category: "visual",
    name: "인물 영상 + 아래 자막",
    describe: "Full-bleed talking-head video with a bottom caption banner.",
    hint: "말하는 사람 영상이 꽉 차고 아래에 자막 띠. 영상 전용.",
    compatibleSourceTypes: ["video"],
    defaultDurationSec: 3,
  },
  "ui-demo-frame": {
    id: "ui-demo-frame",
    category: "visual",
    name: "앱 화면 데모",
    describe: "Media framed inside a mock editor app window (title bar + prompt input) — product demo page.",
    hint: "가짜 앱 창(제목 표시줄+입력칸) 안에 미디어. 제품 시연 페이지.",
    compatibleSourceTypes: ["image", "video"],
    defaultDurationSec: 3,
  },
  "canvas-grid": {
    id: "canvas-grid",
    category: "visual",
    name: "이미지 4분할 모음",
    describe: "Light note-canvas with a 2x2 collage grid of FOUR images — variations/gallery page.",
    hint: "밝은 배경에 서로 다른 4장의 이미지를 2×2 카드로 모아 보여줘요.",
    compatibleSourceTypes: ["image"],
    sourceSlots: [
      { key: "A", label: "1번 (좌상)" },
      { key: "B", label: "2번 (우상)" },
      { key: "C", label: "3번 (좌하)" },
      { key: "D", label: "4번 (우하)" },
    ],
    defaultDurationSec: 3,
  },
  "model-selector": {
    id: "model-selector",
    category: "visual",
    name: "AI 모델 선택 화면",
    describe: "Mock AI-model dropdown overlay on the media — 'choose your model' page.",
    hint: "미디어 위에 가짜 'AI 모델 선택' 드롭다운 오버레이.",
    compatibleSourceTypes: ["image", "video"],
    defaultDurationSec: 3,
  },
  "plain-caption": {
    id: "plain-caption",
    category: "visual",
    name: "기본 (배경 + 자막)",
    describe: "Full-bleed media with a single caption banner — generic b-roll page.",
    hint: "배경이 꽉 차고 아래 자막 하나. 가장 무난한 기본형.",
    compatibleSourceTypes: ["image", "video"],
    defaultDurationSec: 3,
  },
  "compare-2up": {
    id: "compare-2up",
    category: "visual",
    name: "2분할 비교 (A vs B)",
    describe:
      "Top/bottom split comparing TWO different media (A vs B) with a center VS divider — comparison page. Needs a second source; the LLM only writes the first prompt, so use it sparingly.",
    hint: "서로 다른 두 이미지를 위/아래로 나눠 비교(가운데 VS). 소스 2개 필요.",
    compatibleSourceTypes: ["image", "video"],
    sourceSlots: [
      { key: "A", label: "A (위)" },
      { key: "B", label: "B (아래)" },
    ],
    defaultDurationSec: 3,
  },
  "split-media-text": {
    id: "split-media-text",
    category: "visual",
    name: "상하 분할 (이미지+문구)",
    describe: "Top media (60%) over a bottom brand panel; media enters fullscreen then springs into its box.",
    hint: "위 이미지(60%)+아래 문구. 등장 시 전체화면→상단으로 좁혀져요(앞 페이지가 같은 미디어 전체화면이면 이어지는 느낌).",
    compatibleSourceTypes: ["image", "video"],
    defaultDurationSec: 3,
  },
  "quote-card": {
    id: "quote-card",
    category: "visual",
    name: "인용 카드 (후기)",
    describe: "Full-bleed dimmed media with a big centered quote + attribution — social proof.",
    hint: "어둡게 깔린 배경 위에 큰 따옴표 인용구 + 출처. 후기/사회적 증거.",
    compatibleSourceTypes: ["image", "video"],
    defaultDurationSec: 3,
  },
  "big-stat": {
    id: "big-stat",
    category: "visual",
    name: "큰 숫자 강조",
    describe: "Dimmed media bg + one huge stat/number (the caption) + product label — punchy proof.",
    hint: "자막을 아주 크게(숫자/통계 강조). 예: ‘10배’, ‘무료’.",
    compatibleSourceTypes: ["image", "video"],
    defaultDurationSec: 3,
  },
};

/** Media slots a visual fills, with labels. Defaults to a single "메인 미디어" slot. */
export function visualSourceSlots(id: string): { key: "A" | "B" | "C" | "D"; label: string }[] {
  return VISUAL_METAS[id]?.sourceSlots ?? [{ key: "A", label: "메인 미디어 (이미지/영상)" }];
}

export const MOTION_METAS: Record<string, TemplateMeta> = {
  none: {
    id: "none",
    category: "motion",
    name: "정지 (움직임 없음)",
    describe: "No motion — static image or plain video playback.",
    hint: "움직임 없이 그대로. 영상은 그대로 재생돼요.",
    compatibleSourceTypes: ["image", "video"],
  },
  "ken-burns-zoom": {
    id: "ken-burns-zoom",
    category: "motion",
    name: "천천히 확대",
    describe: "Slow zoom-in on a still image (Ken Burns).",
    hint: "정지 이미지를 서서히 줌인. 잔잔한 생동감(켄번즈).",
    compatibleSourceTypes: ["image"],
  },
  pan: {
    id: "pan",
    category: "motion",
    name: "좌우로 이동",
    describe: "Slow horizontal pan over a still image.",
    hint: "이미지를 가로로 천천히 훑어요(패닝).",
    compatibleSourceTypes: ["image"],
  },
  "shrink-into-ui": {
    id: "shrink-into-ui",
    category: "motion",
    name: "확대 → 앱화면으로 축소",
    describe: "Signature move: starts zoomed to fullscreen, springs down to reveal the UI frame.",
    hint: "꽉 찬 상태에서 시작해 앱 창 크기로 탁 줄어드는 시그니처 동작.",
    compatibleSourceTypes: ["image", "video"],
  },
  "caption-pop": {
    id: "caption-pop",
    category: "motion",
    name: "톡 튀어나옴",
    describe: "Snappy spring pop-in of the page content.",
    hint: "내용이 통통 튀듯 등장(스프링 팝).",
    compatibleSourceTypes: ["image", "video"],
  },
  "zoom-out": {
    id: "zoom-out",
    category: "motion",
    name: "천천히 축소",
    describe: "Slow zoom-out — starts pushed in, pulls back to reveal.",
    hint: "확대된 상태에서 천천히 빠지며 드러나요(줌아웃).",
    compatibleSourceTypes: ["image", "video"],
  },
  "drift-up": {
    id: "drift-up",
    category: "motion",
    name: "위로 흐름",
    describe: "Gentle upward drift (parallax feel).",
    hint: "화면이 위로 천천히 흐르는 시네마틱 느낌.",
    compatibleSourceTypes: ["image", "video"],
  },
  "rotate-in": {
    id: "rotate-in",
    category: "motion",
    name: "회전하며 등장",
    describe: "Subtle rotate + settle on entrance.",
    hint: "살짝 기울었다 제자리로 돌아오며 등장.",
    compatibleSourceTypes: ["image", "video"],
  },
};

export const TRANSITION_METAS: Record<string, TemplateMeta> = {
  cut: { id: "cut", category: "transition", name: "바로 전환 (컷)", describe: "Hard cut, no blending.", hint: "효과 없이 즉시 다음 페이지로. 빠른 호흡에 좋아요.", durationFrames: 0 },
  fade: { id: "fade", category: "transition", name: "부드럽게 (페이드)", describe: "Soft crossfade between pages.", hint: "이전/다음 페이지가 부드럽게 겹치며 바뀜.", durationFrames: 12 },
  slide: { id: "slide", category: "transition", name: "옆으로 밀기", describe: "Next page slides in from the right.", hint: "다음 페이지가 오른쪽에서 밀려 들어와요.", durationFrames: 12 },
  wipe: { id: "wipe", category: "transition", name: "닦아내기 (와이프)", describe: "Directional wipe reveal into the next page.", hint: "한 방향으로 닦아내며 다음 페이지가 드러남.", durationFrames: 12 },
  flip: { id: "flip", category: "transition", name: "플립 (3D 뒤집기)", describe: "3D card flip to the next page.", hint: "카드처럼 3D로 뒤집히며 전환.", durationFrames: 16 },
  "clock-wipe": { id: "clock-wipe", category: "transition", name: "시계 와이프", describe: "Radial clock sweep reveal.", hint: "시계바늘처럼 원을 그리며 다음 페이지가 드러남.", durationFrames: 16 },
  "zoom-blur": { id: "zoom-blur", category: "transition", name: "확대 블러", describe: "Punchy zoom-blur burst (use before the endcard).", hint: "확 확대되며 흐려지는 강한 전환. 엔드카드 직전에 추천.", durationFrames: 14 },
  "dreamy-zoom": { id: "dreamy-zoom", category: "transition", name: "회전 확대", describe: "Dreamy rotating zoom blend.", hint: "살짝 회전하며 확대되는 몽환적 전환.", durationFrames: 18 },
};

export const ENDCARD_METAS: Record<string, TemplateMeta> = {
  "logo-blur-in": {
    id: "logo-blur-in",
    category: "endcard",
    name: "로고 또렷해짐 + 한 줄 소개",
    describe: "Brand logo sharpens from a blur, product one-liner below.",
    hint: "흐릿하던 로고가 또렷해지고 아래에 한 줄 소개.",
    defaultDurationSec: 3,
  },
  "logo-cta": {
    id: "logo-cta",
    category: "endcard",
    name: "로고 + CTA 버튼",
    describe: "Brand logo with a call-to-action button.",
    hint: "로고 아래에 행동 유도(CTA) 버튼 알약.",
    defaultDurationSec: 3,
  },
};

// Safe defaults — unknown ids coerce to these (LLM drift, removed templates).
export const DEFAULT_VISUAL = "plain-caption";
export const DEFAULT_MOTION = "none";
export const DEFAULT_TRANSITION = "cut";

export const visualMeta = (id: string): TemplateMeta => VISUAL_METAS[id] ?? VISUAL_METAS[DEFAULT_VISUAL];
export const motionMeta = (id: string): TemplateMeta => MOTION_METAS[id] ?? MOTION_METAS[DEFAULT_MOTION];
export const transitionMeta = (id: string): TemplateMeta => TRANSITION_METAS[id] ?? TRANSITION_METAS[DEFAULT_TRANSITION];

/** Series-overlap length for a transition id (0 = cut/unknown). */
export function transitionDurationFrames(id: string): number {
  return transitionMeta(id).durationFrames ?? 12;
}

/** JSON-safe metadata list for the UI and the LLM prompt. */
export function catalog(): TemplateMeta[] {
  return [
    ...Object.values(VISUAL_METAS),
    ...Object.values(MOTION_METAS),
    ...Object.values(TRANSITION_METAS),
    ...Object.values(ENDCARD_METAS),
  ];
}
