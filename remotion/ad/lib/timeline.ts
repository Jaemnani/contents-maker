// Pure frame math for the ad timeline. Browser-safe — shared by AdComposition,
// calculateMetadata, the Player preview and the editor UI (single source of truth).
import { interpolate } from "remotion";
import type { AdPage, AdProject } from "@/lib/ad/schema";
import { AD_FPS, DEFAULT_BASE_VOLUME, DEFAULT_DUCK_VOLUME } from "@/lib/ad/schema";
// meta.ts (pure data) keeps this module importable from server routes too.
import { visualMeta, transitionDurationFrames } from "@/remotion/ad/templates/meta";

export const DEFAULT_PAGE_SEC = 3;

/** Narration playback rate for a project (audio.voSpeed, default 1). */
export function voSpeedOf(project: AdProject): number {
  return project.audio.voSpeed && project.audio.voSpeed > 0 ? project.audio.voSpeed : 1;
}

/**
 * Page length: manual override > VO length (÷ voSpeed — narration plays faster) >
 * visual template default > 3s.
 */
export function pageFrames(page: AdPage, fps: number = AD_FPS, voSpeed = 1): number {
  const sec =
    page.durationOverrideSec ??
    (page.voAudio ? page.voAudio.durationSec / voSpeed : undefined) ??
    visualMeta(page.visualTemplateId).defaultDurationSec ??
    DEFAULT_PAGE_SEC;
  return Math.max(1, Math.round(sec * fps));
}

export function endcardFrames(project: AdProject): number {
  if (!project.endcard.enabled) return 0;
  return Math.max(1, Math.round((project.endcard.durationSec ?? 3) * (project.meta.fps || AD_FPS)));
}

/**
 * Overlap of the transition AFTER page i (into page i+1, or into the endcard for
 * the last page). Clamped so it never exceeds either neighbor. 0 = cut / none.
 */
export function transitionFramesAt(project: AdProject, i: number): number {
  const pages = project.pages;
  if (i < 0 || i >= pages.length) return 0;
  const isLast = i === pages.length - 1;
  const nextFrames = isLast ? endcardFrames(project) : pageFrames(pages[i + 1], project.meta.fps, voSpeedOf(project));
  if (nextFrames <= 0) return 0; // last page with no endcard → no outgoing transition
  // the transition INTO the endcard is configured on the endcard, not the last page
  const transId = isLast && project.endcard.enabled ? project.endcard.transitionTemplateId : pages[i].transitionTemplateId;
  const want = transitionDurationFrames(transId);
  return Math.max(0, Math.min(want, pageFrames(pages[i], project.meta.fps, voSpeedOf(project)) - 1, nextFrames - 1));
}

/** Timeline start frame of each page (transition overlaps pull pages earlier). */
export function pageOffsets(project: AdProject): number[] {
  const fps = project.meta.fps || AD_FPS;
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < project.pages.length; i++) {
    out.push(acc);
    acc += pageFrames(project.pages[i], fps, voSpeedOf(project)) - transitionFramesAt(project, i);
  }
  return out;
}

export function adTotalFrames(project: AdProject): number {
  const fps = project.meta.fps || AD_FPS;
  let total = 0;
  for (let i = 0; i < project.pages.length; i++) {
    total += pageFrames(project.pages[i], fps, voSpeedOf(project)) - transitionFramesAt(project, i);
  }
  total += endcardFrames(project); // last transition overlap already subtracted above
  return Math.max(1, total);
}

/** Stable identity for a VIDEO source (null for images / none / non-video). */
export function videoSourceKey(s: AdPage["source"]): string | null {
  if (s.kind === "asset" && s.ref.modality === "video") return `a:${s.ref.datasetPath}/${s.ref.file}`;
  if (s.kind === "upload" && /\.(mp4|webm|mov)$/i.test(s.path)) return `u:${s.path}`;
  return null;
}
const videoKey = (page: AdPage) => videoSourceKey(page.source);

/**
 * Per-page video start offset (composition frames) so consecutive pages sharing the SAME
 * video source resume from where the previous page left off — frame-accurate continuity,
 * correct even across crossfades (uses pageOffsets, which already fold in transition overlap).
 */
export function videoStartFrames(project: AdProject): number[] {
  const offsets = pageOffsets(project);
  return project.pages.map((p, i) => {
    const key = videoKey(p);
    if (!key) return 0;
    let r = i; // walk back to the first page of this same-source run
    while (r - 1 >= 0 && videoKey(project.pages[r - 1]) === key) r--;
    return Math.max(0, offsets[i] - offsets[r]);
  });
}

export interface FrameInterval {
  from: number;
  to: number;
}

/** Frame ranges where VO is audible (may bleed past a shortened page — by design). */
export function voIntervals(project: AdProject): FrameInterval[] {
  const fps = project.meta.fps || AD_FPS;
  const offsets = pageOffsets(project);
  const out: FrameInterval[] = [];
  const speed = voSpeedOf(project);
  project.pages.forEach((p, i) => {
    if (!p.voAudio) return;
    const from = offsets[i];
    out.push({ from, to: from + Math.ceil((p.voAudio.durationSec / speed) * fps) });
  });
  return out;
}

/** BGM volume at a frame: base level, ducked under VO with short linear ramps. */
export function bgmVolumeAt(
  frame: number,
  intervals: FrameInterval[],
  opts: { base?: number; ducked?: number; rampFrames?: number } = {}
): number {
  const base = opts.base ?? DEFAULT_BASE_VOLUME;
  const ducked = opts.ducked ?? DEFAULT_DUCK_VOLUME;
  const ramp = opts.rampFrames ?? 9;
  let vol = base;
  for (const { from, to } of intervals) {
    if (frame < from - ramp || frame > to + ramp) continue;
    const v = interpolate(frame, [from - ramp, from, to, to + ramp], [base, ducked, ducked, base], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    vol = Math.min(vol, v);
  }
  return vol;
}
