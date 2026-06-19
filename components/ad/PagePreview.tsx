"use client";
// Compact live preview of a SINGLE page (this page's source + visual + motion) so the
// user sees exactly how the media is placed/cropped. Silent + no endcard — layout only.
import { useMemo } from "react";
import type { AdPage, AdProject } from "@/lib/ad/schema";
import AdPlayer from "@/components/ad/AdPlayer";

export default function PagePreview({ project, page }: { project: AdProject; page: AdPage }) {
  const solo = useMemo<AdProject>(
    () => ({
      ...project,
      pages: [{ ...page, voAudio: undefined }], // silent — preview is about layout/motion
      endcard: { ...project.endcard, enabled: false },
      audio: { bgm: { kind: "none" } },
    }),
    [project, page]
  );
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-ink">
      <AdPlayer project={solo} controls loop autoPlay />
    </div>
  );
}
