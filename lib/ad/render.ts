// Ad project render: composition "Ad", WITH audio (VO + BGM), ko single-language v1.
import "server-only";
import path from "path";
import { renderVideo, type RemotionProgress } from "@/lib/render-remotion/engine";
import { readAdProject, addAdRender, projectDirAbs } from "@/lib/ad/store";
import { timestamp } from "@/lib/storage";

/** Render the ad to renders/ad-ko-<ts>.mp4; returns the outputs/-relative path. */
export async function renderAd(
  projectId: string,
  assetBase: string,
  onProgress?: RemotionProgress
): Promise<string> {
  const project = await readAdProject(projectId);
  if (project.pages.length === 0 && !project.endcard.enabled) {
    throw new Error("렌더할 페이지가 없습니다.");
  }
  const outName = `ad-ko-${timestamp()}.mp4`;
  const outAbs = path.join(projectDirAbs(projectId), "renders", outName);
  await renderVideo({
    compositionId: "Ad",
    inputProps: { project, assetBase },
    outAbs,
    muted: false, // VO + ducked BGM
    onProgress,
  });
  const rel = path.posix.join("outputs", "results", projectId, "renders", outName);
  await addAdRender(projectId, rel);
  return rel;
}
