// Ad maker (v2) domain model — the SINGLE zod schema used at every boundary:
// LLM compose output, UI save, store read/write, and Remotion render props.
// Client-safe: no server-only imports (templates and the Player import these types).
import { z } from "zod";
import type { AssetRef } from "@/lib/composition-types";

export const AD_FPS = 30;
export const AD_W = 1080;
export const AD_H = 1920;

// Output aspect presets — 9:16 (쇼츠/틱톡/클립) and 4:5 (인스타 피드).
export const AD_ASPECTS = {
  "9:16": { width: 1080, height: 1920 },
  "4:5": { width: 1080, height: 1350 },
} as const;
export type AdAspect = keyof typeof AD_ASPECTS;

/** Closest aspect label for stored meta dimensions (default 9:16). */
export function aspectOf(width?: number, height?: number): AdAspect {
  if (!width || !height) return "9:16";
  const r = height / width;
  return Math.abs(r - 1.25) < Math.abs(r - 16 / 9) ? "4:5" : "9:16";
}

// Mirrors the AssetRef interface (lib/composition-types.ts) for runtime validation.
export const zAssetRef = z.object({
  datasetPath: z.string(),
  file: z.string(),
  modality: z.enum(["image", "video"]),
  modelUid: z.string().optional(),
  aspect: z.string().optional(),
  label: z.string().optional(),
  prompt: z.string().optional(),
  thumb: z.string().optional(),
}) satisfies z.ZodType<AssetRef>;

export const zPageSource = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }), // unresolved placeholder (renders a gradient)
  z.object({ kind: z.literal("asset"), ref: zAssetRef }), // AI-generated or picked from the pool
  z.object({ kind: z.literal("upload"), path: z.string() }), // outputs/-relative upload
]);
export type PageSource = z.infer<typeof zPageSource>;

export const zVoAudio = z.object({
  path: z.string(), // outputs/-relative mp3
  durationSec: z.number().positive(),
  hash: z.string(), // sha256(voiceId + "\n" + vo) first 8 hex — regen skip / stale cleanup
  // per-word timing (seconds) — precise from ElevenLabs /with-timestamps, estimated for
  // Gemini. Missing on audio generated before this feature (karaoke falls back to estimate).
  words: z.array(z.object({ w: z.string(), s: z.number(), e: z.number() })).optional(),
});
export type VoAudio = z.infer<typeof zVoAudio>;

// intro animation ids for on-screen text; last five render per-char/word via AnimatedText
export const zTitleEffect = z.enum([
  "fade", "film", "blur", "rise", "pop", "slide", "neon", "stamp", "typewriter", "word-pop", "wave", "shake-text", "count-up",
]);
export type TitleEffect = z.infer<typeof zTitleEffect>;

// one caption STEP — steps replace the single caption, appear sequentially over the page
// (equal time split), each re-running its intro effect with its own style overrides.
export const zCaptionStep = z.object({
  text: z.string(),
  font: z.string().optional(), // falls back to the page's titleFont
  color: z.string().optional(),
  size: z.number().positive().optional(),
  weight: z.number().optional(),
  effect: zTitleEffect.optional(),
});
export type CaptionStep = z.infer<typeof zCaptionStep>;

export const zAdPage = z.object({
  id: z.string(),
  sourceType: z.enum(["image", "video"]),
  source: zPageSource, // slot A (primary)
  sourceB: zPageSource.optional(), // slot B — multi-image visuals (compare-2up, canvas-grid)
  sourceC: zPageSource.optional(), // slot C — canvas-grid
  sourceD: zPageSource.optional(), // slot D — canvas-grid
  visualTemplateId: z.string(),
  motionTemplateId: z.string(),
  transitionTemplateId: z.string(), // transition from THIS page to the next (or endcard)
  caption: z.string(), // on-screen subtitle (ko, v1 single-language)
  captionMode: z.enum(["static", "karaoke"]).optional(), // karaoke = VO words highlighted in sync (default static)
  titleVisible: z.boolean().optional(), // show/hide this page's on-screen text block (default true)
  titlePosition: z.enum(["top", "middle", "bottom"]).optional(), // title-capable visuals (default "top")
  titleY: z.number().min(0).max(100).optional(), // fine vertical position (% from top, block center) — wins over titlePosition; keeps text in the 4:5 safe zone
  captionSteps: z.array(zCaptionStep).optional(), // sequential caption steps (replaces the single caption when non-empty; karaoke wins)
  // ── on-screen text style — applies to this page's caption/title in EVERY layout ──
  titleFont: z.string().optional(), // font key (default "Pretendard"); see remotion/ad/lib/fonts.ts
  titleSize: z.number().positive().optional(), // font-size px (per-layout default if unset)
  titleWeight: z.number().optional(), // font-weight (default 900 title / 800 caption)
  titleItalic: z.boolean().optional(), // italic
  titleLetterSpacing: z.number().optional(), // letter-spacing px (can be negative)
  titleColor: z.string().optional(), // text color hex (default white)
  titleEffect: zTitleEffect.optional(), // intro animation; last five render per-char/word via AnimatedText
  titleBackdrop: z.enum(["banner", "none", "outline", "panel", "glass", "highlight", "scrim"]).optional(), // legibility treatment
  titlePadding: z.number().nonnegative().optional(), // panel/glass inner padding px (default 34)
  compareLabelA: z.string().optional(), // compare-2up: title beside the A tag
  compareLabelB: z.string().optional(), // compare-2up: title beside the B tag
  vo: z.string(), // narration text fed to TTS
  voAudio: zVoAudio.optional(),
  durationOverrideSec: z.number().positive().optional(), // wins over VO length (warn if shorter)
  imagePrompt: z.string().optional(), // image-gen prompt for slot A
  imagePromptB: z.string().optional(), // image-gen prompt for slot B
  imagePromptC: z.string().optional(), // image-gen prompt for slot C
  imagePromptD: z.string().optional(), // image-gen prompt for slot D
  clipQuery: z.string().optional(), // LLM hint for picking a clip from the pool (video pages)
});
export type AdPage = z.infer<typeof zAdPage>;

export const zAdEndcard = z.object({
  enabled: z.boolean(),
  templateId: z.string(), // endcard template
  transitionTemplateId: z.string(), // transition INTO the endcard (last page's exit)
  durationSec: z.number().positive().default(3),
  cta: z.string().optional(), // CTA copy (logo-cta) — falls back to product.cta
  subtitle: z.string().optional(), // one-liner copy (logo-blur-in) — falls back to product.oneLiner
  vo: z.string().optional(), // endcard narration text (e.g. the final push line)
  voAudio: zVoAudio.optional(), // generated endcard narration
});
export type AdEndcard = z.infer<typeof zAdEndcard>;

export const zBgmSource = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("library"), file: z.string() }), // public/bgm/<file> (staticFile)
  z.object({ kind: z.literal("upload"), path: z.string() }), // outputs/-relative
]);
export type BgmSource = z.infer<typeof zBgmSource>;

export const zAdAudio = z.object({
  bgm: zBgmSource,
  baseVolume: z.number().min(0).max(1).optional(), // default 0.6
  duckVolume: z.number().min(0).max(1).optional(), // default 0.25 (under VO)
  sfxEnabled: z.boolean().optional(), // transition whoosh + entrance ding (default false)
  sfxVolume: z.number().min(0).max(1).optional(), // default 0.7
  bpm: z.number().positive().optional(), // BGM tempo — used by "박자 스냅" (beat.ts)
  ttsProvider: z.enum(["auto", "elevenlabs", "gemini"]).optional(), // narration voice provider (default auto)
  voSpeed: z.number().min(0.5).max(2).optional(), // narration playback rate (default 1) — no regen needed
});
export type AdAudio = z.infer<typeof zAdAudio>;

export const zAdProduct = z.object({
  name: z.string(),
  oneLiner: z.string(), // one-sentence pitch
  valueProps: z.array(z.string()), // bullet value propositions
  cta: z.string(),
  brandColor: z.string().optional(), // hex, used by visual templates
  logoPath: z.string().optional(), // outputs/-relative brand logo (endcard); falls back to public/brand/logo.png
  showName: z.boolean().optional(), // show the product name on screen (badge/attribution/label; default true)
});
export type AdProduct = z.infer<typeof zAdProduct>;

export const zAdMeta = z.object({
  topic: z.string(), // trend topic / campaign subject
  seedPrompt: z.string().optional(), // suggested base image-gen prompt (from topic curation) — loadable into pages
  fps: z.number().int().positive().default(AD_FPS),
  width: z.number().int().positive().default(AD_W),
  height: z.number().int().positive().default(AD_H),
});
export type AdMeta = z.infer<typeof zAdMeta>;

export const zAdRenderRecord = z.object({
  path: z.string(), // outputs/-relative mp4
  createdAt: z.string(),
});
export type AdRenderRecord = z.infer<typeof zAdRenderRecord>;

// ── aib content factory (스킬 aib-content-factory · AUTOMATION.md §2-1) ─────────
// 하나의 광고 프로젝트 = 하나의 팩토리 배치. stage 상태 머신을 index.json에 저장해
// 사람(UI)과 러너(ad-auto.mjs)가 같은 상태를 공유한다. 전부 optional — 구 프로젝트 무영향.

export const zContentType = z.enum(["lie_speed", "open_weight", "opinion_clash"]); // 거짓말·속도 / 오픈웨이트 / 의견대립
export type ContentType = z.infer<typeof zContentType>;

export const zFactoryCategory = z.enum(["ai", "economy", "society", "life_culture", "it_science", "world"]);
export type FactoryCategory = z.infer<typeof zFactoryCategory>;

export const zFormatKind = z.enum(["text_only", "card_news", "single_image", "shorts", "ugc_demo"]);
export type FormatKind = z.infer<typeof zFormatKind>;

const zScore = z.enum(["high", "mid", "low"]);
export const zFactoryTopic = z.object({
  title: z.string(),
  category: zFactoryCategory,
  supportedTypes: z.array(zContentType).min(1), // 이 주제가 성립시키는 유형만 만든다 (SKILL 규칙 2)
  scores: z.object({ trend: zScore, fit: zScore, hook: zScore }).optional(), // 3중 스코어링 (트렌드·제품적합·후킹)
  typeNote: z.string().optional(), // 각 유형이 성립하는 근거 한 줄
  sourceNote: z.string().optional(), // 화제 근거 한 줄 (원 헤드라인·출처)
});
export type FactoryTopic = z.infer<typeof zFactoryTopic>;

export const zFormatPreset = z.object({
  recommended: z.array(zFormatKind), // 스킬 추천(기본 체크)
  selected: z.array(zFormatKind), // 사람/러너 확정
});
export type FormatPreset = z.infer<typeof zFormatPreset>;

// aib.vote 비교 결과 소재 — L1은 수동 붙여넣기(STEP3). searchMode는 신뢰성 규칙상 필수.
export const zFactorySource = z.object({
  kind: z.enum(["text", "image"]),
  question: z.string(),
  modelA: z.object({ name: z.string(), answer: z.string() }),
  modelB: z.object({ name: z.string(), answer: z.string() }),
  searchMode: z.enum(["off", "on"]),
  factNote: z.string().optional(), // 실제 사실(반전 근거) — 알고 있으면 기입
  assets: z.array(z.string()).default([]), // outputs/-상대 캡처 이미지
});
export type FactorySource = z.infer<typeof zFactorySource>;

export const zContentPiece = z.object({
  type: zContentType,
  hook: z.string(),
  body: z.string(),
  ctaUrl: z.string(),
});
export type ContentPiece = z.infer<typeof zContentPiece>;

export const zFactoryChannel = z.enum(["dcinside", "naver_cafe", "threads", "x", "instagram", "youtube", "naver_clip", "tiktok", "reddit"]);
export type FactoryChannel = z.infer<typeof zFactoryChannel>;

export const zChannelOutput = z.object({
  channel: zFactoryChannel,
  format: zFormatKind,
  aspectRatio: z.enum(["9:16", "4:5"]).optional(), // 영상 포맷만 — 인스타는 4:5
  title: z.string().optional(),
  body: z.string(),
  tags: z.array(z.string()).default([]),
  parts: z.array(z.string()).optional(), // 스레드·X 2단 구성
});
export type ChannelOutput = z.infer<typeof zChannelOutput>;

export const zFactCheckItem = z.object({
  claim: z.string(),
  treatedAs: z.enum(["fact", "model_said"]), // 콘텐츠가 사실로 단정했나, "모델이 그렇게 답했다"로만 썼나
  verified: z.boolean(),
  note: z.string(),
});
export type FactCheckItem = z.infer<typeof zFactCheckItem>;

export const zPublishPlan = z.object({
  outputs: z.array(zChannelOutput),
  factCheck: z.array(zFactCheckItem),
  schedule: z.string(), // 배포 일정 제안 (글전용 즉시, 영상 제작 후 등)
  rotationMemo: z.string(), // 이번에 못 만든 유형 → 다음 실행 우선
  warnings: z.array(z.string()).optional(), // 생성 중 누락·주의 (조용한 누락 금지)
});
export type PublishPlan = z.infer<typeof zPublishPlan>;

export const zFactoryStage = z.enum([
  "topic_candidates", // L2: 러너가 후보 3개 생성 후 대기
  "format_preset",
  "awaiting_source",
  "packaged",
  "rendered",
  "awaiting_publish",
  "published",
]);
export type FactoryStage = z.infer<typeof zFactoryStage>;

export const zFactoryState = z.object({
  stage: zFactoryStage,
  automationLevel: z.number().int().min(0).max(4).default(1),
  candidates: z.array(zFactoryTopic).optional(), // STEP1 추천 후보 3개 (택1 대기)
  topic: zFactoryTopic.optional(),
  formatPreset: zFormatPreset.optional(),
  source: zFactorySource.optional(),
  pieces: z.array(zContentPiece).optional(),
  plan: zPublishPlan.optional(),
});
export type FactoryState = z.infer<typeof zFactoryState>;

export const zAdProject = z.object({
  // constrained so op:"save" can never write outside outputs/results/ad/ (path is derived from this)
  projectId: z.string().regex(/^ad\/[A-Za-z0-9_-][A-Za-z0-9._-]*$/, 'projectId must be "ad/<timestamp>"'),
  createdAt: z.string(),
  updatedAt: z.string(),
  meta: zAdMeta,
  product: zAdProduct,
  pages: z.array(zAdPage),
  endcard: zAdEndcard,
  audio: zAdAudio,
  latestRender: z.string().nullable().optional(),
  renderHistory: z.array(zAdRenderRecord).optional(),
  factory: zFactoryState.optional(), // aib 콘텐츠 팩토리 배치 상태 (없으면 일반 광고 프로젝트)
});
export type AdProject = z.infer<typeof zAdProject>;

/** LLM compose output (template ids validated/coerced against the registry separately). */
export const zComposePage = z.object({
  sourceType: z.enum(["image", "video"]),
  visualTemplateId: z.string(),
  motionTemplateId: z.string(),
  transitionTemplateId: z.string(),
  caption: z.string(),
  vo: z.string(),
  imagePrompt: z.string().optional(),
  clipQuery: z.string().optional(),
});
export const zComposeOutput = z.object({ pages: z.array(zComposePage) });
export type ComposeOutput = z.infer<typeof zComposeOutput>;

/** The single validation boundary — store writes, compose merges, render entry. */
export function parseAdProject(data: unknown): AdProject {
  return zAdProject.parse(data);
}

export function newPageId(): string {
  // randomUUID is secure-context-only in browsers — fall back for plain-HTTP LAN previews
  const uuid = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2, 10).padEnd(8, "0");
  return "pg-" + uuid.slice(0, 8);
}

/** Fresh page with safe defaults (used by UI "+" and compose merge). */
export function newAdPage(sourceType: "image" | "video" = "image"): AdPage {
  return {
    id: newPageId(),
    sourceType,
    source: { kind: "none" },
    visualTemplateId: "fullscreen-title",
    motionTemplateId: sourceType === "image" ? "ken-burns-zoom" : "none",
    transitionTemplateId: "cut",
    caption: "",
    vo: "",
  };
}

// ── media slots ──────────────────────────────────────────────────────────────
// A page can hold up to 4 media (most visuals use 1; compare-2up=2; canvas-grid=4).
export type SlotKey = "A" | "B" | "C" | "D";
export const SLOT_SOURCE_FIELD = { A: "source", B: "sourceB", C: "sourceC", D: "sourceD" } as const;
export const SLOT_PROMPT_FIELD = { A: "imagePrompt", B: "imagePromptB", C: "imagePromptC", D: "imagePromptD" } as const;

/** Resolve a slot's source (unset slots render as the placeholder gradient). */
export function slotSource(page: AdPage, key: SlotKey): PageSource {
  return (page[SLOT_SOURCE_FIELD[key]] as PageSource | undefined) ?? { kind: "none" };
}
/** Resolve a slot's saved image-gen prompt, if any. */
export function slotPrompt(page: AdPage, key: SlotKey): string | undefined {
  return page[SLOT_PROMPT_FIELD[key]] as string | undefined;
}

export const DEFAULT_BASE_VOLUME = 0.6;
export const DEFAULT_DUCK_VOLUME = 0.25;

/**
 * Fresh page for a chosen visual template (used by the "add page" picker). Picks a
 * sensible source type + motion for that layout. visualMeta lookups are intentionally
 * avoided here (client/server-safe) — callers pass video-only intent if needed.
 */
export function newAdPageForVisual(
  visualId: string,
  compatibleSourceTypes: ("image" | "video")[] = ["image", "video"]
): AdPage {
  const sourceType: "image" | "video" = compatibleSourceTypes.includes("image") ? "image" : "video";
  const base = newAdPage(sourceType);
  const motionTemplateId =
    visualId === "ui-demo-frame" ? "shrink-into-ui" : base.motionTemplateId;
  return { ...base, visualTemplateId: visualId, motionTemplateId };
}
