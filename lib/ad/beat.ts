// Beat snapping — align page cuts to the BGM tempo. Client-safe (pure math).
// Each page's effective duration is rounded UP to the nearest beat multiple, so VO can
// never be cut shorter (the existing "VO bleeds into the next page" rule is preserved).
import type { AdPage, AdProject } from "@/lib/ad/schema";
import { visualMeta } from "@/remotion/ad/templates/meta";

const EPSILON = 0.02; // float slack so an exact multiple doesn't jump a full beat

/** A page's effective duration under the current rules (override > VO÷speed > template > 3s). */
export function effectiveSec(page: AdPage, voSpeed = 1): number {
  return (
    page.durationOverrideSec ??
    (page.voAudio ? page.voAudio.durationSec / voSpeed : undefined) ??
    visualMeta(page.visualTemplateId).defaultDurationSec ??
    3
  );
}

/** Snap every page's duration UP to the beat grid (bpm) via durationOverrideSec. */
export function snapPagesToBeat(pages: AdPage[], bpm: number, voSpeed = 1): AdPage[] {
  if (!(bpm > 0)) return pages;
  const beat = 60 / bpm;
  return pages.map((p) => {
    const eff = effectiveSec(p, voSpeed);
    const snapped = Math.ceil((eff - EPSILON) / beat) * beat;
    const rounded = Math.round(snapped * 100) / 100;
    if (Math.abs(rounded - eff) < 0.005) return p; // already on the grid
    return { ...p, durationOverrideSec: rounded };
  });
}

/** Convenience: snapped pages for a whole project (uses audio.bpm). */
export function snapProjectToBeat(project: AdProject): AdPage[] | null {
  const bpm = project.audio.bpm;
  if (!bpm) return null;
  return snapPagesToBeat(project.pages, bpm, project.audio.voSpeed && project.audio.voSpeed > 0 ? project.audio.voSpeed : 1);
}
