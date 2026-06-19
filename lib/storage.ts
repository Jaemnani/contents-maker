// Local persistence for shorts_maker. Server-only.
//   outputs/sources/<type>/<timestamp>/   generated source assets (images/videos) + index.json
//   outputs/results/<sourceType>/<timestamp>/  compositions (see lib/post/composition.ts)
//   outputs/uploads/                        shared uploads (logos)
//   outputs/index.json                      global, newest-first source index (picker/recent)
import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { GenResult, Language, Modality } from "@/lib/types";
import { getOpenRouterKey } from "@/lib/env";

export const OUTPUTS_ROOT = path.join(process.cwd(), "outputs");
export const SOURCES_ROOT = path.join(OUTPUTS_ROOT, "sources");
export const RESULTS_ROOT = path.join(OUTPUTS_ROOT, "results");
export const UPLOADS_ROOT = path.join(OUTPUTS_ROOT, "uploads");
export const GLOBAL_INDEX = path.join(OUTPUTS_ROOT, "index.json");

export function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** uid -> filesystem-safe stem. */
export const safe = (id: string) => id.replace(/[/:]/g, "-");

/** Resolve an outputs/-relative path to an absolute path, blocking traversal escapes. */
export function safeOutputsPath(rel: string): string {
  const clean = rel.replace(/^outputs[\\/]/, "");
  const abs = path.resolve(OUTPUTS_ROOT, clean);
  if (abs !== OUTPUTS_ROOT && !abs.startsWith(OUTPUTS_ROOT + path.sep)) {
    throw new Error(`unsafe path: ${rel}`);
  }
  return abs;
}

// ---- source assets ----

export interface SourceFileMeta {
  file: string; // folder-relative
  model: string; // model uid
  aspect?: string; // image only
  thumb?: string; // folder-relative poster (video); images self-thumb
}

export interface SourceEntry {
  path: string; // outputs/-relative folder
  kind: "source";
  type: Modality; // image | video (| text)
  prompt: string;
  language: Language;
  createdAt: string;
  models: string[];
  totalCost: number;
  files: SourceFileMeta[];
}

export interface SourceBatchPayload {
  type: Modality;
  language: Language;
  prompt: string;
  results: GenResult[];
}

export interface SaveOutcome {
  savedTo: string; // outputs/-relative folder
  files: string[];
  totalCost: number;
  entry: SourceEntry;
}

async function writeImageResult(dir: string, base: string, r: GenResult, files: string[], metaFiles: SourceFileMeta[]) {
  for (const img of r.images ?? []) {
    const aspectTag = img.aspect.replace(":", "x");
    if (img.dataUrl.startsWith("data:")) {
      const comma = img.dataUrl.indexOf(",");
      if (comma < 0) continue;
      const mime = img.dataUrl.slice(5, comma).split(";")[0];
      const ext = mime.split("/")[1] || "png";
      const fname = `${base}-${aspectTag}.${ext}`;
      await fs.writeFile(path.join(dir, fname), Buffer.from(img.dataUrl.slice(comma + 1), "base64"));
      files.push(fname);
      metaFiles.push({ file: fname, model: r.model, aspect: img.aspect, thumb: fname });
    } else if (/^https?:\/\//i.test(img.dataUrl)) {
      const res = await fetch(img.dataUrl);
      if (res.ok) {
        const ext = (res.headers.get("content-type") || "image/png").split("/")[1]?.split(";")[0] || "png";
        const fname = `${base}-${aspectTag}.${ext}`;
        await fs.writeFile(path.join(dir, fname), Buffer.from(await res.arrayBuffer()));
        files.push(fname);
        metaFiles.push({ file: fname, model: r.model, aspect: img.aspect, thumb: fname });
      }
    }
  }
}

async function writeVideoResult(dir: string, base: string, r: GenResult, files: string[], metaFiles: SourceFileMeta[]) {
  if (!r.videoUrl) return;
  const headers = /^https:\/\/openrouter\.ai\//i.test(r.videoUrl)
    ? { Authorization: `Bearer ${getOpenRouterKey()}` }
    : undefined;
  const res = await fetch(r.videoUrl, { headers });
  if (!res.ok) return;
  const fname = `${base}.mp4`;
  await fs.writeFile(path.join(dir, fname), Buffer.from(await res.arrayBuffer()));
  files.push(fname);
  // No system-ffmpeg poster — the UI renders a <video> element thumbnail for videos.
  metaFiles.push({ file: fname, model: r.model });
}

/** Persist a generation batch (one prompt, N models, one modality) as a single source folder. */
export async function saveSourceBatch(payload: SourceBatchPayload): Promise<SaveOutcome> {
  const ts = timestamp();
  const relDir = path.posix.join("outputs", "sources", payload.type, ts);
  const dir = path.join(SOURCES_ROOT, payload.type, ts);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(path.join(dir, "prompt.txt"), payload.prompt, "utf8");

  const files: string[] = [];
  const metaFiles: SourceFileMeta[] = [];
  for (const r of payload.results) {
    if (r.status === "error") continue;
    const base = safe(r.model);
    try {
      if (payload.type === "image") await writeImageResult(dir, base, r, files, metaFiles);
      else if (payload.type === "video") await writeVideoResult(dir, base, r, files, metaFiles);
    } catch {
      /* skip a failed file write; keep the rest */
    }
  }

  const totalCost = payload.results.reduce((s, r) => s + (r.actualCost ?? 0), 0);
  const createdAt = new Date().toISOString();
  const entry: SourceEntry = {
    path: relDir,
    kind: "source",
    type: payload.type,
    prompt: payload.prompt,
    language: payload.language,
    createdAt,
    models: payload.results.map((r) => r.model),
    totalCost,
    files: metaFiles,
  };
  await fs.writeFile(path.join(dir, "index.json"), JSON.stringify(entry, null, 2), "utf8");
  await appendGlobalIndex(entry);

  files.push("prompt.txt", "index.json");
  return { savedTo: relDir, files, totalCost, entry };
}

// ---- global source index ----

export async function readGlobalIndex(): Promise<SourceEntry[]> {
  try {
    const list = JSON.parse(await fs.readFile(GLOBAL_INDEX, "utf8"));
    return Array.isArray(list) ? (list as SourceEntry[]) : [];
  } catch {
    return [];
  }
}

async function appendGlobalIndex(entry: SourceEntry): Promise<void> {
  const list = await readGlobalIndex();
  list.unshift(entry);
  await fs.mkdir(OUTPUTS_ROOT, { recursive: true });
  await fs.writeFile(GLOBAL_INDEX, JSON.stringify(list, null, 2), "utf8");
}

// ---- uploads ----

/** Save an uploaded binary (e.g. a logo) under a base dir; returns the outputs/-relative path. */
export async function saveUpload(buf: Buffer, fileName: string, baseRel = "outputs/uploads"): Promise<string> {
  const abs = safeOutputsPath(baseRel);
  await fs.mkdir(abs, { recursive: true });
  const clean = safe(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
  const fname = `${timestamp()}-${clean}`;
  await fs.writeFile(path.join(abs, fname), buf);
  return path.posix.join(baseRel.replace(/\\/g, "/"), fname);
}
