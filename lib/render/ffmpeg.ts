// Low-level ffmpeg/ffprobe helpers for the renderer. Server-only.
// Techniques (run/spawn, encodeArgs, COVER, zoompan Ken Burns, xfade) reused from the
// proven contents-maker composer, generalized for the new layout-driven renderer.
import "server-only";
import { spawn } from "child_process";
import { getFfmpegPath, getFfprobePath } from "@/lib/env";

export const W = 1080;
export const H = 1920;
export const HALF = 960;
export const FPS = 30;
export const TRANS = 0.4; // xfade duration (s)

export class FfmpegError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FfmpegError";
  }
}

/** Run a binary with an args array (no shell). Rejects with trimmed stderr on non-zero exit. */
export function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args);
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (c) =>
      c === 0
        ? resolve()
        : reject(new FfmpegError(err.trim().split("\n").slice(-12).join("\n") || `${bin} exited ${c}`))
    );
  });
}

export const ffmpeg = (args: string[]) => run(getFfmpegPath(), ["-hide_banner", "-loglevel", "error", "-y", ...args]);

export const DEFAULT_PRESET = "slow";
export const DEFAULT_CRF = 18;

export const encodeArgs = (preset = DEFAULT_PRESET, crf = DEFAULT_CRF): string[] => [
  "-c:v", "libx264", "-preset", preset, "-crf", String(crf), "-pix_fmt", "yuv420p",
  "-r", String(FPS), "-video_track_timescale", "30000",
];

/** Scale-to-cover + center-crop a source to exactly w×h. */
export const cover = (w: number, h: number) =>
  `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`;

/** Eased Ken Burns zoom expression (smoothstep 1.0 -> 1+amount over `frames`). */
export const kenBurns = (frames: number, amount = 0.12) =>
  `1+${amount}*(3*pow(on/${frames - 1},2)-2*pow(on/${frames - 1},3))`;

// zoompan jitters on stills because the pan origin rounds to whole input pixels each frame.
// Upscaling the input first makes that ±1px land sub-pixel after the downscale → smooth.
export const SUPERSAMPLE = 4;

/**
 * Smooth Ken Burns push-in for an input already sized w×h: supersample, then zoompan back
 * to w×h (full frame at zoom=1, eased push-in to 1+amount). No wobble.
 */
export const kenBurnsChain = (w: number, h: number, frames: number, amount = 0.12) =>
  `scale=${w * SUPERSAMPLE}:${h * SUPERSAMPLE}:flags=bicubic,` +
  `zoompan=z='${kenBurns(frames, amount)}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${w}x${h}:fps=${FPS}`;

/** Probe a media file's duration in seconds (0 on failure). */
export function probeDuration(absPath: string): Promise<number> {
  return new Promise((resolve) => {
    const p = spawn(getFfprobePath(), [
      "-v", "error", "-select_streams", "v:0",
      "-show_entries", "format=duration", "-of", "default=nokey=1:noprint_wrappers=1", absPath,
    ]);
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.on("error", () => resolve(0));
    p.on("close", () => resolve(Number(out.trim()) || 0));
  });
}

/**
 * Assemble pre-rendered segments with xfade transitions into one muted mp4.
 * `transition`: id from the (extensible) registry — controls first/later transition styles.
 */
export async function assembleSegments(
  segs: { file: string; dur: number }[],
  outPath: string,
  opts: { preset?: string; crf?: number; transition?: string } = {}
): Promise<number> {
  const enc = encodeArgs(opts.preset, opts.crf);
  if (segs.length === 1) {
    await ffmpeg(["-i", segs[0].file, "-an", "-c", "copy", "-movflags", "+faststart", outPath]).catch(async () => {
      // re-encode fallback if stream copy is rejected
      await ffmpeg(["-i", segs[0].file, ...enc, "-an", "-movflags", "+faststart", outPath]);
    });
    return segs[0].dur;
  }
  const [first, later] = transitionPair(opts.transition);
  const vins = segs.flatMap((s) => ["-i", s.file]);
  let xf = segs.map((_, i) => `[${i}:v]format=yuv420p,fps=${FPS},setsar=1[v${i}]`).join(";") + ";";
  let prev = "[v0]";
  let acc = segs[0].dur;
  for (let i = 1; i < segs.length; i++) {
    const off = acc - TRANS;
    const out = i === segs.length - 1 ? "[vout]" : `[x${i}]`;
    const trans = i === 1 ? first : later;
    xf += `${prev}[v${i}]xfade=transition=${trans}:duration=${TRANS}:offset=${off.toFixed(3)}${out};`;
    prev = out;
    acc += segs[i].dur - TRANS;
  }
  xf = xf.replace(/;$/, "");
  await ffmpeg(["-an", ...vins, "-filter_complex", xf, "-map", "[vout]", ...enc, "-movflags", "+faststart", outPath]);
  return acc;
}

/** Map a transition id to [firstTransition, laterTransition] xfade names. */
function transitionPair(id?: string): [string, string] {
  switch (id) {
    case "fade":
      return ["fade", "fade"];
    case "cut":
      return ["fadeblack", "fadeblack"]; // near-cut (0.4s) — true hard cut handled by concat elsewhere
    case "slide":
      return ["slideleft", "slideleft"];
    case "default":
    default:
      return ["slideleft", "fade"]; // start->main slide, main->end fade
  }
}
