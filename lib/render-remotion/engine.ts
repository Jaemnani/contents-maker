// Programmatic Remotion render: bundle once (cached) → selectComposition → renderMedia.
// Replaces the ffmpeg renderer. Remotion bundles its own ffmpeg (no system ffmpeg needed).
// Generic core (renderVideo) shared by the comparison short ("Short", muted) and the
// ad maker ("Ad", with audio — see lib/ad/render.ts).
import "server-only";
import path from "path";
import { promises as fs } from "fs";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia, ensureBrowser } from "@remotion/renderer";
import { readComposition, addRender, compDirAbs, compRelDir } from "@/lib/post/composition";
import { timestamp } from "@/lib/storage";
import type { Language } from "@/lib/types";

let bundleCache: Promise<string> | null = null;

/**
 * Bundle the remotion/ project; reuse the serve URL across renders IN PRODUCTION only.
 * In dev the bundle must be rebuilt per render — the dev server hot-reloads code, and a
 * process-lifetime cache would silently render with STALE components (the preview shows
 * the new behavior, the mp4 doesn't).
 */
function getServeUrl(): Promise<string> {
  const dev = process.env.NODE_ENV !== "production";
  if (dev || !bundleCache) {
    bundleCache = bundle({
      entryPoint: path.join(process.cwd(), "remotion", "index.ts"),
      // resolve the app's "@/..." alias inside the Remotion webpack bundle
      webpackOverride: (conf) => ({
        ...conf,
        resolve: {
          ...conf.resolve,
          alias: { ...(conf.resolve?.alias ?? {}), "@": path.join(process.cwd()) },
        },
      }),
    });
  }
  return bundleCache;
}

export type RemotionProgress = (p: { progress: number; stage: string }) => void;

/** Generic render: any registered composition id → h264 mp4 at outAbs. */
export async function renderVideo(opts: {
  compositionId: string;
  inputProps: Record<string, unknown>;
  outAbs: string;
  muted: boolean;
  onProgress?: RemotionProgress;
}): Promise<void> {
  const { compositionId, inputProps, outAbs, muted, onProgress } = opts;
  onProgress?.({ progress: 0, stage: "browser" });
  await ensureBrowser();

  onProgress?.({ progress: 0, stage: "bundle" });
  const serveUrl = await getServeUrl();
  const composition = await selectComposition({ serveUrl, id: compositionId, inputProps });

  await fs.mkdir(path.dirname(outAbs), { recursive: true });
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: outAbs,
    inputProps,
    muted,
    chromiumOptions: { gl: "angle" }, // enable WebGL2 for shader (html-in-canvas) transitions
    onProgress: ({ progress }) => onProgress?.({ progress, stage: "render" }),
  });
  onProgress?.({ progress: 1, stage: "done" });
}

/** Render one language of a comparison short to a muted 1080×1920 mp4. */
export async function renderRemotion(
  compId: string,
  language: Language,
  assetBase: string,
  onProgress?: RemotionProgress
): Promise<string> {
  const comp = await readComposition(compId);
  // same-prompt guard (defense in depth)
  const main = comp.stages.find((s) => s.id === "main");
  if (main?.aRef?.prompt && main?.bRef?.prompt && main.aRef.prompt !== main.bRef.prompt) {
    throw new Error("본론 A/B는 같은 프롬프트로 만든 소스여야 합니다.");
  }

  const outName = `short-${language}-${timestamp()}.mp4`;
  const outAbs = path.join(compDirAbs(compId), "renders", outName);
  await renderVideo({
    compositionId: "Short",
    inputProps: { comp, language, assetBase },
    outAbs,
    muted: true, // v1 silent output (also strips any source-video audio)
    onProgress,
  });

  const rel = path.posix.join(compRelDir(compId), "renders", outName);
  await addRender(compId, language, rel); // append to render history (kept across re-renders)
  return rel;
}
