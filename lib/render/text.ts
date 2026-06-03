// sharp-based text & card rendering for the renderer (no ffmpeg drawtext). Server-only.
// All overlay text is rendered to transparent PNGs here, then composited by ffmpeg/sharp.
import "server-only";
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { W, H } from "./ffmpeg";
import type { CardTemplate } from "@/lib/render/strings";

const FONTS = path.join(process.cwd(), "assets", "fonts");
export const F_BLACK = { file: path.join(FONTS, "Pretendard-Black.otf"), fam: "Pretendard Black" };
export const F_SEMI = { file: path.join(FONTS, "Pretendard-SemiBold.otf"), fam: "Pretendard SemiBold" };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface Font {
  file: string;
  fam: string;
}

/** Render text to a transparent PNG buffer (Pango markup via sharp). */
export async function textBuf(text: string, f: Font, size: number, color: string, width: number): Promise<Buffer> {
  return sharp({
    text: {
      text: `<span foreground="${color}">${esc(text)}</span>`,
      fontfile: f.file,
      font: `${f.fam} ${size}`,
      rgba: true,
      width,
      align: "centre",
      spacing: 6,
    },
  })
    .png()
    .toBuffer();
}

/** Text with a soft drop shadow for legibility over busy backgrounds. */
export async function textShadow(
  text: string,
  f: Font,
  size: number,
  color: string,
  width: number,
  blur = 6
): Promise<Buffer> {
  const txt = await textBuf(text, f, size, color, width);
  const m = await sharp(txt).metadata();
  const pad = Math.ceil(blur * 3) + 8;
  const shadow = await sharp(txt).tint({ r: 0, g: 0, b: 0 }).blur(blur).toBuffer();
  return sharp({
    create: {
      width: (m.width ?? width) + pad * 2,
      height: (m.height ?? size) + pad * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: shadow, top: pad + 3, left: pad },
      { input: txt, top: pad, left: pad },
    ])
    .png()
    .toBuffer();
}

const rectSvg = (w: number, h: number, r: number, fill: string) =>
  Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}"/></svg>`
  );

/** A label pill: rounded translucent bg + centered text. Returns a PNG buffer. */
export async function pill(text: string, size = 40, fg = "white", bg = "rgba(8,10,22,0.62)"): Promise<Buffer> {
  const txt = await textShadow(text, F_SEMI, size, fg, 880, 5);
  const m = await sharp(txt).metadata();
  const w = Math.min(1000, (m.width ?? 400) + 56);
  const h = (m.height ?? 60) + 16;
  return sharp(await sharp(rectSvg(w, h, h / 2, bg)).png().toBuffer())
    .composite([{ input: txt, gravity: "centre" }])
    .png()
    .toBuffer();
}

/** Full 1080×1920 card background from a template (gradient/solid). */
export async function gradientBg(tpl: CardTemplate): Promise<Buffer> {
  const defs =
    tpl.kind === "gradient" && tpl.to
      ? `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tpl.from}"/><stop offset="1" stop-color="${tpl.to}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>`
      : `<rect width="${W}" height="${H}" fill="${tpl.from}"/>`;
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${defs}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** White rounded-rect mask (for alphamerge to round panel corners). */
export async function roundedMask(w: number, h: number, r: number): Promise<Buffer> {
  return sharp(rectSvg(w, h, r, "#ffffff")).png().toBuffer();
}

/** Circular "VS" badge PNG. */
export async function vsBadge(size = 184): Promise<Buffer> {
  const circle = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">` +
      `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 6}" fill="#0067b7"/>` +
      `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 6}" fill="none" stroke="#ffffff" stroke-width="6" opacity="0.9"/></svg>`
  );
  const txt = await textShadow("VS", F_BLACK, Math.round(size * 0.42), "#ffffff", size, 4);
  return sharp(await sharp(circle).png().toBuffer()).composite([{ input: txt, gravity: "centre" }]).png().toBuffer();
}

/** Composite a finished card PNG: background + positioned blocks. Writes to outPath. */
export async function renderCardPng(
  bg: Buffer,
  blocks: { buf: Buffer; cx?: number; y: number }[],
  outPath: string
): Promise<void> {
  const comp: sharp.OverlayOptions[] = [];
  for (const b of blocks) {
    const m = await sharp(b.buf).metadata();
    const left = Math.round((b.cx ?? W / 2) - (m.width ?? 0) / 2);
    comp.push({ input: b.buf, top: Math.round(b.y - (m.height ?? 0) / 2), left });
  }
  await sharp(bg).composite(comp).png().toFile(outPath);
}

/** Persist any buffer to a PNG file (for ffmpeg -i inputs). */
export async function writePng(buf: Buffer, outPath: string): Promise<string> {
  await fs.writeFile(outPath, buf);
  return outPath;
}
