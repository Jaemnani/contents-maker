// One-click style themes — a coherent font/effect/backdrop/transition/motion set applied
// across ALL pages in a single (undoable) patch. Pure data + pure function, client-safe.
// A theme is an ACTION, not state: nothing is stored on the project (no schema change),
// and it never touches sources/caption/vo/voAudio/durations/captionMode.
import type { AdPage, AdProject } from "@/lib/ad/schema";
import { MOTION_METAS } from "@/remotion/ad/templates/meta";

type PageStyle = Partial<
  Pick<AdPage, "titleFont" | "titleEffect" | "titleBackdrop" | "titleWeight" | "titleLetterSpacing" | "titleItalic" | "titlePadding">
>;

export interface AdTheme {
  id: string;
  name: string;
  hint: string;
  swatch: string; // chip accent color in the UI
  chipFont: string; // CSS font-family for the chip label preview
  pageStyle: PageStyle;
  transition: { default: string; last: string }; // last = into the endcard
  motion: { image: string; video: string; keep: string[] }; // keep = signature motions to preserve
  brandColor?: string;
  sfxEnabled?: boolean;
}

export const AD_THEMES: AdTheme[] = [
  {
    id: "cinematic",
    name: "시네마틱",
    hint: "명조 세리프 · 필름 페이드 · 느린 무빙",
    swatch: "#8a7a5c",
    chipFont: "'Nanum Myeongjo', serif",
    pageStyle: { titleFont: "Nanum Myeongjo", titleEffect: "film", titleBackdrop: "scrim", titleWeight: 600, titleLetterSpacing: 2 },
    transition: { default: "fade", last: "spin-zoom" },
    motion: { image: "drift-up", video: "parallax-float", keep: ["shrink-into-ui"] },
    sfxEnabled: false,
  },
  {
    id: "pop",
    name: "팝",
    hint: "굵은 고딕 · 팝 배너 · 휙휙 넘김 + 효과음",
    swatch: "#ff5a1f",
    chipFont: "'Black Han Sans', sans-serif",
    pageStyle: { titleFont: "Black Han Sans", titleEffect: "pop", titleBackdrop: "banner", titleWeight: 900, titleLetterSpacing: 0 },
    transition: { default: "whip-pan", last: "zoom-blur" },
    motion: { image: "pulse", video: "caption-pop", keep: ["shrink-into-ui"] },
    sfxEnabled: true,
  },
  {
    id: "glitch",
    name: "글리치",
    hint: "네온 · 흔들리는 글자 · 지지직 전환",
    swatch: "#38f2c8",
    chipFont: "'Bebas Neue', sans-serif",
    pageStyle: { titleFont: "Bebas Neue", titleEffect: "shake-text", titleBackdrop: "outline", titleWeight: 900, titleLetterSpacing: 4 },
    transition: { default: "glitch", last: "glitch" },
    motion: { image: "shake", video: "shake", keep: ["shrink-into-ui"] },
    brandColor: "#38f2c8",
    sfxEnabled: true,
  },
  {
    id: "minimal",
    name: "미니멀",
    hint: "깔끔한 고딕 · 배경 없음 · 페이드만",
    swatch: "#9aa4b2",
    chipFont: "Pretendard, sans-serif",
    pageStyle: { titleFont: "Pretendard", titleEffect: "fade", titleBackdrop: "none", titleWeight: 600, titleLetterSpacing: 0, titleItalic: false },
    transition: { default: "fade", last: "fade" },
    motion: { image: "ken-burns-zoom", video: "none", keep: [] },
    sfxEnabled: false,
  },
  {
    id: "kitsch",
    name: "키치",
    hint: "둥근 주아체 · 형광펜 · 단어 팝 + 플립",
    swatch: "#ff8fc7",
    chipFont: "Jua, sans-serif",
    pageStyle: { titleFont: "Jua", titleEffect: "word-pop", titleBackdrop: "highlight", titleWeight: 400, titleLetterSpacing: 0 },
    transition: { default: "flip", last: "iris" },
    motion: { image: "rotate-in", video: "rotate-in", keep: ["shrink-into-ui"] },
    sfxEnabled: true,
  },
];

/** True when a motion id can run on the page's source type. */
function motionCompatible(motionId: string, sourceType: AdPage["sourceType"]): boolean {
  const m = MOTION_METAS[motionId];
  if (!m) return false;
  return (m.compatibleSourceTypes ?? ["image", "video"]).includes(sourceType);
}

/**
 * Build the project patch for a theme. Overwrites STYLE fields only — sources, captions,
 * VO/voAudio, durations and captionMode are untouched. Re-applying is idempotent.
 */
export function themePatch(project: AdProject, theme: AdTheme): Partial<AdProject> {
  const lastIdx = project.pages.length - 1;
  const pages = project.pages.map((p, i) => {
    const keepMotion = theme.motion.keep.includes(p.motionTemplateId);
    const wanted = p.sourceType === "video" ? theme.motion.video : theme.motion.image;
    const motionTemplateId = keepMotion ? p.motionTemplateId : motionCompatible(wanted, p.sourceType) ? wanted : p.motionTemplateId;
    // the LAST page's exit is configured on the endcard when it's enabled — leave it
    const transitionTemplateId = i === lastIdx && project.endcard.enabled ? p.transitionTemplateId : theme.transition.default;
    return { ...p, ...theme.pageStyle, motionTemplateId, transitionTemplateId };
  });
  return {
    pages,
    endcard: project.endcard.enabled ? { ...project.endcard, transitionTemplateId: theme.transition.last } : project.endcard,
    product: theme.brandColor ? { ...project.product, brandColor: theme.brandColor } : project.product,
    audio: theme.sfxEnabled != null ? { ...project.audio, sfxEnabled: theme.sfxEnabled } : project.audio,
  };
}
