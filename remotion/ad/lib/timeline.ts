// Pure frame math for the ad timeline. Browser-safe — shared by AdComposition,
// calculateMetadata, the Player preview and the editor UI (single source of truth).
import { interpolate } from "remotion";
import type { AdPage, AdProject } from "@/lib/ad/schema";
import { AD_FPS, DEFAULT_BASE_VOLUME, DEFAULT_DUCK_VOLUME } from "@/lib/ad/schema";
// meta.ts (pure data) keeps this module importable from server routes too.
import { visualMeta, transitionDurationFrames } from "@/remotion/ad/templates/meta";

export const DEFAULT_PAGE_SEC = 3;

/** Page length: manual override > VO length > visual template default > 3s. */
export function pageFrames(page: AdPage, fps: number = AD_FPS): number {
  const sec =
    page.durationOverrideSec ??
    page.voAudio?.durationSec ??
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
  const nextFrames = isLast ? endcardFrames(project) : pageFrames(pages[i + 1], project.meta.fps);
  if (nextFrames <= 0) return 0; // last page with no endcard → no outgoing transition
  // the transition INTO the endcard is configured on the endcard, not the last page
  const transId = isLast && project.endcard.enabled ? project.endcard.transitionTemplateId : pages[i].transitionTemplateId;
  const want = transitionDurationFrames(transId);
  return Math.max(0, Math.min(want, pageFrames(pages[i], project.meta.fps) - 1, nextFrames - 1));
}

/** Timeline start frame of each page (transition overlaps pull pages earlier). */
export function pageOffsets(project: AdProject): number[] {
  const fps = project.meta.fps || AD_FPS;
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < project.pages.length; i++) {
    out.push(acc);
    acc += pageFrames(project.pages[i], fps) - transitionFramesAt(project, i);
  }
  return out;
}

export function adTotalFrames(project: AdProject): number {
  const fps = project.meta.fps || AD_FPS;
  let total = 0;
  for (let i = 0; i < project.pages.length; i++) {
    total += pageFrames(project.pages[i], fps) - transitionFramesAt(project, i);
  }
  total += endcardFrames(project); // last transition overlap already subtracted above
  return Math.max(1, total);
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
  project.pages.forEach((p, i) => {
    if (!p.voAudio) return;
    const from = offsets[i];
    out.push({ from, to: from + Math.ceil(p.voAudio.durationSec * fps) });
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
