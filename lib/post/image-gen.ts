// Shared server-side single-image generator: dispatches on a model uid's serving
// (fal/ws/openrouter) and returns either the raw URL/dataURL (for saveDataset) or a Buffer
// (for sharp compositing). Reused by 시안 backgrounds, the comparison frame, and pair generation.
import "server-only";
import { generateFalImage } from "@/lib/fal/image";
import { generateWsImage } from "@/lib/ws/image";
import { generateImage } from "@/lib/openrouter/image";
import { MODELS_BY_ID } from "@/lib/models";
import type { Language, ImageResolution } from "@/lib/types";

export interface GenImageOpts {
  uid: string;
  prompt: string;
  language: Language;
  aspect?: string; // default 9:16
  resolution?: ImageResolution; // default 1k
  enhance?: boolean; // default false
}

export interface RawImage {
  dataUrl: string; // a data: URL (openrouter) or a public https URL (fal/ws)
  cost: number | null;
  ms: number;
}

/** Generate one image; returns the provider's URL/dataURL (+ cost/ms) for storage. */
export async function generateImageRaw(opts: GenImageOpts): Promise<RawImage> {
  const m = MODELS_BY_ID[opts.uid];
  if (!m || m.modality !== "image") throw new Error(`이미지 모델이 아닙니다: ${opts.uid}`);
  const args = {
    model: m.id,
    prompt: opts.prompt,
    aspect: opts.aspect ?? "9:16",
    language: opts.language,
    enhance: opts.enhance ?? false,
    resolution: opts.resolution ?? ("1k" as const),
  };
  const start = Date.now();
  if (m.serving === "fal") {
    const { urls, cost } = await generateFalImage(args);
    if (!urls[0]) throw new Error("이미지 생성 실패 (빈 결과)");
    return { dataUrl: urls[0], cost, ms: Date.now() - start };
  }
  if (m.serving === "ws") {
    const { urls, cost } = await generateWsImage(args);
    if (!urls[0]) throw new Error("이미지 생성 실패 (빈 결과)");
    return { dataUrl: urls[0], cost, ms: Date.now() - start };
  }
  const { dataUrls, cost } = await generateImage(args);
  const du = dataUrls[0];
  if (!du) throw new Error("이미지 생성 실패 (빈 결과)");
  return { dataUrl: du, cost, ms: Date.now() - start };
}

/** Generate one image and return it as a Buffer (fetches URLs / decodes data URLs). */
export async function generateImageBuffer(opts: GenImageOpts): Promise<Buffer> {
  const { dataUrl } = await generateImageRaw(opts);
  if (dataUrl.startsWith("data:")) {
    const comma = dataUrl.indexOf(",");
    return Buffer.from(dataUrl.slice(comma + 1), "base64");
  }
  const res = await fetch(dataUrl);
  if (!res.ok) throw new Error(`이미지 다운로드 실패 (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
