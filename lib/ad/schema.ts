// Ad maker (v2) domain model — the SINGLE zod schema used at every boundary:
// LLM compose output, UI save, store read/write, and Remotion render props.
// Client-safe: no server-only imports (templates and the Player import these types).
import { z } from "zod";
import type { AssetRef } from "@/lib/composition-types";

export const AD_FPS = 30;
export const AD_W = 1080;
export const AD_H = 1920;

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
});
export type VoAudio = z.infer<typeof zVoAudio>;

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
  titlePosition: z.enum(["top", "middle", "bottom"]).optional(), // title-capable visuals (default "top")
  // ── on-screen text style — applies to this page's caption/title in EVERY layout ──
  titleFont: z.string().optional(), // font key (default "Pretendard"); see remotion/ad/lib/fonts.ts
  titleSize: z.number().positive().optional(), // font-size px (per-layout default if unset)
  titleWeight: z.number().optional(), // font-weight (default 900 title / 800 caption)
  titleItalic: z.boolean().optional(), // italic
  titleLetterSpacing: z.number().optional(), // letter-spacing px (can be negative)
  titleColor: z.string().optional(), // text color hex (default white)
  titleEffect: z
    .enum(["fade", "film", "blur", "rise", "pop", "slide", "neon", "stamp", "typewriter", "word-pop", "wave", "shake-text", "count-up"])
    .optional(), // intro animation; last five render per-char/word via AnimatedText
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
});
export type AdAudio = z.infer<typeof zAdAudio>;

export const zAdProduct = z.object({
  name: z.string(),
  oneLiner: z.string(), // one-sentence pitch
  valueProps: z.array(z.string()), // bullet value propositions
  cta: z.string(),
  brandColor: z.string().optional(), // hex, used by visual templates
  logoPath: z.string().optional(), // outputs/-relative brand logo (endcard); falls back to public/brand/logo.png
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
    visualTemplateId: "plain-caption",
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
