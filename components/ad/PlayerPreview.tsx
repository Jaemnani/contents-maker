"use client";
// Live Remotion Player preview — same AdComposition + same props as the server render
// (assetBase "" → relative /api/file URLs). Player loads client-only.
import type { AdProject } from "@/lib/ad/schema";
import { adTotalFrames } from "@/remotion/ad/lib/timeline";
import AdPlayer from "@/components/ad/AdPlayer";

export default function PlayerPreview({ project }: { project: AdProject }) {
  const frames = adTotalFrames(project);
  const sec = (frames / (project.meta.fps || 30)).toFixed(1);
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-lg border border-border bg-ink">
        <AdPlayer project={project} />
      </div>
      <div className="text-right text-xs text-muted">
        총 {sec}초 · {frames}프레임 · {project.meta.width || 1080}×{project.meta.height || 1920}
      </div>
    </div>
  );
}
