// Main(body) layout builders: split (A) / panels (B) / headline (C).
// Each returns a finished body segment mp4 (1080×1920) for the given sources. Server-only.
import "server-only";
import path from "path";
import { W, H, HALF, FPS, ffmpeg, cover, kenBurnsChain, encodeArgs, probeDuration } from "./ffmpeg";
import { pill, gradientBg, roundedMask, vsBadge, writePng } from "./text";
import type { MainLayout, MotionStyle, PanelStyle, VideoFit, SourceType, LabelPos } from "@/lib/composition-types";

export interface BodyOpts {
  tmp: string;
  sourceType: SourceType;
  aPath: string;
  bPath: string;
  bgPath?: string | null;
  layout: MainLayout;
  motionStyle: MotionStyle;
  panelStyle: PanelStyle;
  videoFit: VideoFit;
  durSec: number; // image-compare body length; videos may override (videoFit)
  labels?: { a?: string; b?: string };
  showLabels: boolean;
  labelPos?: LabelPos;
  preset?: string;
  crf?: number;
}

const DIVIDER = (y: number) =>
  `drawbox=x=0:y=${y - 6}:w=iw:h=12:color=#0067b7@0.30:t=fill,drawbox=x=0:y=${y - 2}:w=iw:h=4:color=#3b9aff@0.95:t=fill`;

const hasVs = (m: MotionStyle) => m === "kenburns-vs" || m === "spotlight-vs";
const hasKenBurns = (m: MotionStyle) => m === "kenburns-vs" || m === "spotlight-vs";

/** Resolve body duration for video sources per videoFit (images use durSec as-is). */
async function resolveDuration(o: BodyOpts): Promise<number> {
  if (o.sourceType !== "video") return o.durSec;
  const [da, db] = await Promise.all([probeDuration(o.aPath), probeDuration(o.bPath)]);
  if (!da && !db) return o.durSec;
  switch (o.videoFit) {
    case "trim":
      return Math.max(1, Math.min(da || db, db || da));
    case "sequential":
      return (da || 0) + (db || 0);
    case "loop":
    case "freeze":
    default:
      return Math.max(da, db) || o.durSec;
  }
}

/** A scaled+animated half/panel source filter for input index `idx`, output label `lbl`. */
function srcFilter(o: BodyOpts, idx: number, lbl: string, w: number, h: number, frames: number): string {
  if (o.sourceType === "video") {
    // loop/freeze/trim are handled by input flags + trim; here we just scale to size.
    return `[${idx}:v]${cover(w, h)},fps=${FPS}[${lbl}]`;
  }
  if (hasKenBurns(o.motionStyle)) {
    return `[${idx}:v]${cover(w, h)},${kenBurnsChain(w, h, frames, 0.12)}[${lbl}]`;
  }
  return `[${idx}:v]${cover(w, h)},fps=${FPS}[${lbl}]`;
}

/** Build source inputs (image: looped still; video: stream-looped or plain per fit). */
function sourceInputs(o: BodyOpts, dur: number): string[] {
  if (o.sourceType === "video") {
    const loop = o.videoFit === "loop";
    const a = loop ? ["-stream_loop", "-1", "-i", o.aPath] : ["-i", o.aPath];
    const b = loop ? ["-stream_loop", "-1", "-i", o.bPath] : ["-i", o.bPath];
    return [...a, ...b];
  }
  return ["-loop", "1", "-t", String(dur), "-i", o.aPath, "-loop", "1", "-t", String(dur), "-i", o.bPath];
}

async function overlayInputs(o: BodyOpts, dur: number): Promise<{ args: string[]; files: { kind: string; idx: number }[] }> {
  const files: { kind: string; idx: number }[] = [];
  const args: string[] = [];
  let idx = 2; // 0=A, 1=B
  if (o.showLabels && o.labels?.a) {
    await writePng(await pill(o.labels.a, 40), path.join(o.tmp, "la.png"));
    args.push("-loop", "1", "-t", String(dur), "-i", path.join(o.tmp, "la.png"));
    files.push({ kind: "la", idx: idx++ });
  }
  if (o.showLabels && o.labels?.b) {
    await writePng(await pill(o.labels.b, 40), path.join(o.tmp, "lb.png"));
    args.push("-loop", "1", "-t", String(dur), "-i", path.join(o.tmp, "lb.png"));
    files.push({ kind: "lb", idx: idx++ });
  }
  if (hasVs(o.motionStyle)) {
    await writePng(await vsBadge(184), path.join(o.tmp, "vs.png"));
    args.push("-loop", "1", "-t", String(dur), "-i", path.join(o.tmp, "vs.png"));
    files.push({ kind: "vs", idx: idx++ });
  }
  return { args, files };
}

// ---------- A: full-bleed split ----------
async function buildSplit(o: BodyOpts, dur: number, out: string): Promise<void> {
  const frames = Math.max(2, Math.round(dur * FPS));
  const inputs = sourceInputs(o, dur);
  const { args: ovArgs, files } = await overlayInputs(o, dur);

  let fc = `${srcFilter(o, 0, "t", W, HALF, frames)};${srcFilter(o, 1, "b", W, HALF, frames)};`;
  fc += `[t][b]vstack=inputs=2[s];[s]${DIVIDER(HALF)}[base];`;
  const lp = o.labelPos ?? "tl";
  const xFor = lp === "tl" ? "40" : lp === "tr" ? "W-w-40" : "(W-w)/2";
  let cur = "[base]";
  let k = 0;
  for (const f of files) {
    const pos =
      f.kind === "la" ? `${xFor}:40` :
      f.kind === "lb" ? `${xFor}:${HALF + 40}` :
      "(W-w)/2:(H-h)/2"; // vs always center
    fc += `[${f.idx}:v]format=rgba[p${k}];${cur}[p${k}]overlay=${pos}[c${k}];`;
    cur = `[c${k}]`;
    k++;
  }
  fc += `${cur}format=yuv420p[v]`;
  await ffmpeg([...inputs, ...ovArgs, "-filter_complex", fc, "-map", "[v]", ...encodeArgs(o.preset, o.crf), "-t", String(dur), "-an", out]);
}

// ---------- B: panels over background ----------
async function buildPanels(o: BodyOpts, dur: number, out: string): Promise<void> {
  const frames = Math.max(2, Math.round(dur * FPS));
  const PW = 920, PH = 760, MX = (W - PW) / 2, TOP_Y = 300, BOT_Y = 1140;
  const radius = o.panelStyle === "square-border" ? 0 : 48;
  const bgTpl = { id: "x", label: "", kind: "gradient" as const, from: "#0b1215", to: "#1b2735" };
  const bgFile = o.bgPath ?? (await writePng(await gradientBg(bgTpl), path.join(o.tmp, "panelbg.png")));
  await writePng(await roundedMask(PW, PH, radius), path.join(o.tmp, "mask.png"));

  const inputs = [
    "-loop", "1", "-t", String(dur), "-i", bgFile,
    ...sourceInputs(o, dur),
    "-loop", "1", "-t", String(dur), "-i", path.join(o.tmp, "mask.png"),
  ];
  const maskIdx = 3; // 0=bg,1=A,2=B,3=mask
  const { args: ovArgs, files } = await overlayInputs(o, dur);

  let fc = `[0:v]${cover(W, H)}[bg];`;
  fc += `${srcFilter(o, 1, "ar", PW, PH, frames)};${srcFilter(o, 2, "br", PW, PH, frames)};`;
  fc += `[${maskIdx}:v]format=gray,split=2[ma][mb];`;
  fc += `[ar][ma]alphamerge[ap];[br][mb]alphamerge[bp];`;
  fc += `[bg][ap]overlay=${MX}:${TOP_Y}[f1];[f1][bp]overlay=${MX}:${BOT_Y}[base];`;
  const lp = o.labelPos ?? "tl";
  const xFor = lp === "tl" ? `${MX + 20}` : lp === "tr" ? `${MX + PW} - w - 20` : `${MX} + (${PW}-w)/2`;
  let cur = "[base]";
  let k = 0;
  for (const f of files) {
    const pos =
      f.kind === "la" ? `${xFor}:${TOP_Y + 20}` :
      f.kind === "lb" ? `${xFor}:${BOT_Y + 20}` :
      "(W-w)/2:(H-h)/2";
    fc += `[${f.idx}:v]format=rgba[p${k}];${cur}[p${k}]overlay=${pos}[c${k}];`;
    cur = `[c${k}]`;
    k++;
  }
  fc += `${cur}format=yuv420p[v]`;
  await ffmpeg([...inputs, ...ovArgs, "-filter_complex", fc, "-map", "[v]", ...encodeArgs(o.preset, o.crf), "-t", String(dur), "-an", out]);
}

// ---------- C: top headline band + split ----------
async function buildHeadline(o: BodyOpts, dur: number, out: string, bandPng?: string | null): Promise<void> {
  const frames = Math.max(2, Math.round(dur * FPS));
  const BAND = 300, SPLIT_H = (H - BAND) / 2; // 810
  const inputs = sourceInputs(o, dur);
  const bandInput = bandPng ? ["-loop", "1", "-t", String(dur), "-i", bandPng] : [];
  const bandIdx = 2;
  const { args: ovArgs, files } = await overlayInputs(o, dur);

  let fc = `${srcFilter(o, 0, "t", W, SPLIT_H, frames)};${srcFilter(o, 1, "b", W, SPLIT_H, frames)};`;
  fc += `[t][b]vstack=inputs=2[sv];[sv]pad=${W}:${H}:0:${BAND}:color=#0b1215[pad];`;
  fc += `[pad]${DIVIDER(BAND)}[base];`;
  let cur = "[base]";
  let k = 0;
  if (bandPng) {
    fc += `[${bandIdx}:v]format=rgba[band];${cur}[band]overlay=0:0[cb];`;
    cur = "[cb]";
  }
  const ovStart = bandPng ? bandIdx + 1 : bandIdx;
  const lp = o.labelPos ?? "tl";
  const xFor = lp === "tl" ? "40" : lp === "tr" ? "W-w-40" : "(W-w)/2";
  let fi = 0;
  for (const f of files) {
    const inIdx = ovStart + fi;
    const pos =
      f.kind === "la" ? `${xFor}:${BAND + 20}` :
      f.kind === "lb" ? `${xFor}:${BAND + SPLIT_H + 20}` :
      "(W-w)/2:(H-h)/2";
    fc += `[${inIdx}:v]format=rgba[p${k}];${cur}[p${k}]overlay=${pos}[c${k}];`;
    cur = `[c${k}]`;
    k++;
    fi++;
  }
  fc += `${cur}format=yuv420p[v]`;
  await ffmpeg([...inputs, ...bandInput, ...ovArgs, "-filter_complex", fc, "-map", "[v]", ...encodeArgs(o.preset, o.crf), "-t", String(dur), "-an", out]);
}

/** Build the main body segment. Returns the mp4 path and its duration. */
export async function buildMainBody(o: BodyOpts, bandPng?: string | null): Promise<{ file: string; dur: number }> {
  const dur = await resolveDuration(o);
  const out = path.join(o.tmp, "body.mp4");
  if (o.layout === "panels") await buildPanels(o, dur, out);
  else if (o.layout === "headline") await buildHeadline(o, dur, out, bandPng);
  else await buildSplit(o, dur, out);
  return { file: out, dur };
}
