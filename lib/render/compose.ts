// composeShort(): render a 3-stage short (start card -> main body -> end card) to a muted
// 1080×1920 mp4 for a given language. Server-only. v1 has no audio (-an).
import "server-only";
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import sharp from "sharp";
import { W, H, FPS, ffmpeg, cover, kenBurnsChain, encodeArgs, assembleSegments } from "./ffmpeg";
import { gradientBg, renderCardPng, textShadow, F_BLACK, F_SEMI } from "./text";
import { buildMainBody } from "./layouts";
import { cardTemplate, pickText, TOPICS } from "@/lib/render/strings";
import { safeOutputsPath, timestamp } from "@/lib/storage";
import { compDirAbs, compRelDir } from "@/lib/post/composition";
import type { Composition, Stage, AssetRef, TextPos } from "@/lib/composition-types";
import type { Language } from "@/lib/types";

const CARD_FADE = 0.4;

export interface ComposeOpts {
  language: Language;
  preset?: string;
  crf?: number;
  onProgress?: (stage: string, detail?: string) => void;
}

function resolveAsset(ref?: AssetRef): string | null {
  if (!ref) return null;
  return safeOutputsPath(path.posix.join(ref.datasetPath, ref.file));
}

/** Is a template light-toned (→ dark text)? */
function isLightTemplate(id?: string): boolean {
  return id === "light" || id === "canvas";
}

function anchorY(pos: TextPos | undefined): number {
  if (pos === "top") return 380;
  if (pos === "bottom") return H - 520;
  return Math.round(H * 0.46);
}

/** Build the card background buffer (template gradient OR resolved image, cover-fit). */
async function cardBg(stage: Stage): Promise<Buffer> {
  const img = stage.image;
  if (img && (img.source === "ai" || img.source === "pick") && img.ref) {
    const abs = resolveAsset(img.ref);
    if (abs) return sharp(abs).resize(W, H, { fit: "cover", position: "centre" }).png().toBuffer();
  }
  return gradientBg(cardTemplate(img?.templateId));
}

/** Dim a background with a translucent ink scrim so white overlay text stays legible. */
async function dimBuffer(bg: Buffer, alpha: number): Promise<Buffer> {
  const scrim = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="rgba(11,18,21,${alpha})"/></svg>`
  );
  return sharp(bg).composite([{ input: scrim, top: 0, left: 0 }]).png().toBuffer();
}

/** Render a start/end card PNG into tmp; returns its path (or null if disabled). */
async function buildCardPng(stage: Stage, lang: Language, tmp: string): Promise<string | null> {
  const bg = await cardBg(stage);
  const out = path.join(tmp, `${stage.id}.png`);
  if (stage.textMode === "in-image") {
    // Text already baked into the image (or intentionally blank template) — ship bg verbatim.
    await sharp(bg).png().toFile(out);
    return out;
  }
  // Over an image background, lay a dark scrim so the (white) overlay text stays legible.
  const onImage = (stage.image?.source === "ai" || stage.image?.source === "pick") && !!stage.image?.ref;
  const base = onImage ? await dimBuffer(bg, 0.5) : bg;
  const light = isLightTemplate(stage.image?.templateId) && stage.image?.source === "template";
  const fg = light ? "#0b1215" : "#ffffff";
  const blocks: { buf: Buffer; cx?: number; y: number }[] = [];

  if (stage.id === "start") {
    const headline = pickText(stage.headline, lang);
    const sub = pickText(stage.sub, lang);
    const y0 = anchorY(stage.textPos);
    if (headline) {
      const buf = await textShadow(headline, F_BLACK, 92, fg, 960, 9);
      const m = await sharp(buf).metadata();
      blocks.push({ buf, y: y0 });
      if (sub) {
        const sbuf = await textShadow(sub, F_SEMI, 44, fg, 900, 4);
        const sm = await sharp(sbuf).metadata();
        blocks.push({ buf: sbuf, y: y0 + (m.height ?? 100) / 2 + (sm.height ?? 60) / 2 + 28 });
      }
    } else if (sub) {
      blocks.push({ buf: await textShadow(sub, F_SEMI, 56, fg, 900, 4), y: y0 });
    }
  } else {
    // end card: toggleable elements (logo + positioned text blocks)
    for (const el of stage.elements ?? []) {
      if (!el.enabled) continue;
      // Text elements follow the stage's textPos control; the logo keeps its own (center).
      const posToken = el.kind === "text" ? stage.textPos ?? (typeof el.pos === "string" ? el.pos : "center") : el.pos;
      const y = typeof el.pos === "object" ? el.pos.y : anchorY(posToken as TextPos);
      const cx = typeof el.pos === "object" ? el.pos.x : undefined;
      if (el.kind === "logo" && el.assetPath) {
        const abs = safeOutputsPath(el.assetPath);
        const buf = await sharp(abs).resize(el.size ?? 720).png().toBuffer();
        blocks.push({ buf, cx, y });
      } else if (el.kind === "text") {
        const txt = pickText(el.text, lang);
        if (txt) blocks.push({ buf: await textShadow(txt, F_BLACK, el.size ?? 64, fg, 960, 6), cx, y });
      }
    }
  }
  await renderCardPng(base, blocks, out);
  return out;
}

/** Turn a still card PNG into a segment (subtle zoom + fade). */
async function cardSegment(png: string, dur: number, tmp: string, id: string, opts: ComposeOpts, fade: "in" | "out" | "none"): Promise<{ file: string; dur: number }> {
  const NC = Math.max(2, Math.round(dur * FPS));
  const fadeF =
    fade === "in" ? `,fade=t=in:st=0:d=${CARD_FADE}` :
    fade === "out" ? `,fade=t=out:st=${(dur - 0.5).toFixed(2)}:d=0.5` : "";
  const out = path.join(tmp, `${id}.mp4`);
  await ffmpeg([
    "-loop", "1", "-t", String(dur), "-i", png,
    "-filter_complex",
    `[0:v]${cover(W, H)},${kenBurnsChain(W, H, NC, 0.05)}${fadeF},format=yuv420p[v]`,
    "-map", "[v]", ...encodeArgs(opts.preset, opts.crf), "-t", String(dur), "-an", out,
  ]);
  return { file: out, dur };
}

/** Headline band PNG (1080×300, transparent) for layout C — topic/start headline text. */
async function headlineBandPng(comp: Composition, lang: Language, tmp: string): Promise<string | null> {
  const start = comp.stages.find((s) => s.id === "start");
  const text = pickText(start?.headline, lang) || pickText(TOPICS[comp.topicId]?.copy.headline, lang);
  if (!text) return null;
  const txt = await textShadow(text, F_BLACK, 58, "#ffffff", 1000, 6);
  const out = path.join(tmp, "band.png");
  await sharp({ create: { width: W, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: txt, gravity: "centre" }])
    .png()
    .toFile(out);
  return out;
}

/** Render the whole composition for one language. Returns the outputs/-relative mp4 path. */
export async function composeShort(comp: Composition, opts: ComposeOpts): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sm-render-"));
  try {
    const stages = comp.stages.filter((s) => s.enabled).sort((a, b) => a.order - b.order);
    const segs: { file: string; dur: number }[] = [];
    const lastIdx = stages.length - 1;

    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      if (s.id === "main") {
        opts.onProgress?.("main", "본문 합성");
        const aPath = resolveAsset(s.aRef);
        const bPath = resolveAsset(s.bRef);
        if (!aPath || !bPath) throw new Error("본론 비교 소스(A/B)가 설정되지 않았습니다.");
        const bgPath = resolveAsset(s.image?.ref);
        const layout = s.layout ?? "split";
        const bandPng = layout === "headline" ? await headlineBandPng(comp, opts.language, tmp) : null;
        const { file, dur } = await buildMainBody(
          {
            tmp,
            sourceType: comp.sourceType,
            aPath,
            bPath,
            bgPath,
            layout,
            motionStyle: s.motionStyle ?? "kenburns-vs",
            panelStyle: s.panelStyle ?? "rounded-shadow",
            videoFit: s.videoFit ?? "loop",
            durSec: s.bodyDurationSec ?? s.durationSec ?? 6,
            labels: { a: s.aLabel ?? s.aRef?.label, b: s.bLabel ?? s.bRef?.label },
            showLabels: s.showLabels ?? true,
            labelPos: s.labelPos ?? "tl",
            preset: opts.preset,
            crf: opts.crf,
          },
          bandPng
        );
        segs.push({ file, dur });
      } else {
        opts.onProgress?.(s.id, `${s.id} 카드`);
        const png = await buildCardPng(s, opts.language, tmp);
        if (!png) continue;
        const fade = s.id === "start" && i === 0 ? "in" : i === lastIdx ? "out" : "none";
        segs.push(await cardSegment(png, s.durationSec ?? 3, tmp, s.id, opts, fade));
      }
    }
    if (!segs.length) throw new Error("렌더할 단계가 없습니다.");

    opts.onProgress?.("assemble", "세그먼트 조립");
    const rendersDir = path.join(compDirAbs(comp.compId), "renders");
    await fs.mkdir(rendersDir, { recursive: true });
    // Unique per render so re-renders never overwrite earlier outputs.
    const outName = `short-${opts.language}-${timestamp()}.mp4`;
    const outAbs = path.join(rendersDir, outName);
    await assembleSegments(segs, outAbs, { preset: opts.preset, crf: opts.crf, transition: comp.renderOpts.transition });

    opts.onProgress?.("done", "완료");
    return path.posix.join(compRelDir(comp.compId), "renders", outName);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
