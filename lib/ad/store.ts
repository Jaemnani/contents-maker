// Server-only persistence for AdProject artifacts (mirrors lib/post/composition.ts).
//   outputs/results/ad/<timestamp>/index.json   project
//   outputs/results/ad/<timestamp>/audio/       per-page VO mp3s
//   outputs/results/ad/<timestamp>/renders/     rendered mp4s
import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { safeOutputsPath, RESULTS_ROOT, timestamp } from "@/lib/storage";
import { parseAdProject, newAdPage, AD_FPS, AD_W, AD_H } from "@/lib/ad/schema";
import type { AdProject, AdPage, AdProduct } from "@/lib/ad/schema";
import { tapnow9BeatPages, TAPNOW_PRODUCT } from "@/lib/ad/presets/tapnow-9beat";

const AD_ROOT = path.join(RESULTS_ROOT, "ad");

/** Absolute folder for a project. projectId = "ad/<timestamp>". */
export function projectDirAbs(projectId: string): string {
  return safeOutputsPath(path.posix.join("results", projectId));
}
/** outputs/-relative project folder (for /api/file URLs). */
export function projectRelDir(projectId: string): string {
  return path.posix.join("outputs", "results", projectId);
}
const projectFile = (projectId: string) => path.join(projectDirAbs(projectId), "index.json");

export type AdPreset = "tapnow-9beat" | "empty";

const DEFAULT_PRODUCT: AdProduct = {
  name: "내 제품",
  oneLiner: "한 줄 소개를 입력하세요",
  valueProps: [],
  cta: "지금 시작하기",
};

export async function createAdProject(opts: { preset?: AdPreset; topic?: string; seedPrompt?: string }): Promise<AdProject> {
  const now = new Date().toISOString();
  const preset = opts.preset ?? "empty";
  const pages: AdPage[] = preset === "tapnow-9beat" ? tapnow9BeatPages() : [newAdPage("image")];
  const project: AdProject = {
    projectId: path.posix.join("ad", timestamp()),
    createdAt: now,
    updatedAt: now,
    meta: { topic: opts.topic ?? "", seedPrompt: opts.seedPrompt || undefined, fps: AD_FPS, width: AD_W, height: AD_H },
    product: preset === "tapnow-9beat" ? { ...TAPNOW_PRODUCT } : { ...DEFAULT_PRODUCT },
    pages,
    endcard: { enabled: true, templateId: "logo-cta", transitionTemplateId: "zoom-blur", durationSec: 3 },
    audio: { bgm: { kind: "none" } },
    latestRender: null,
    renderHistory: [],
  };
  await writeAdProject(project);
  return project;
}

// Per-project write lock: index.json mutations are read-modify-write (render add/remove,
// TTS/BGM/page-image delta writes, whole-project saves). Without serialization two
// overlapping ops last-writer-wins and silently drop each other's result.
const projectLocks = new Map<string, Promise<unknown>>();
export function withProjectLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  const prev = projectLocks.get(projectId) ?? Promise.resolve();
  const next = prev.then(fn, fn); // run regardless of the previous op's outcome
  projectLocks.set(projectId, next.catch(() => {})); // keep the chain alive on errors
  return next;
}

/** Serialized read→mutate→write for one project (the safe way to do delta updates). */
export async function mutateAdProject(projectId: string, mutator: (p: AdProject) => void | Promise<void>): Promise<AdProject> {
  return withProjectLock(projectId, async () => {
    const project = await readAdProject(projectId);
    await mutator(project);
    return writeAdProjectUnlocked(project);
  });
}

/** zod-validated write — the single mutation boundary (atomic tmp+rename). */
async function writeAdProjectUnlocked(data: unknown): Promise<AdProject> {
  const project = parseAdProject(data);
  project.updatedAt = new Date().toISOString();
  const dir = projectDirAbs(project.projectId);
  await fs.mkdir(dir, { recursive: true });
  const file = projectFile(project.projectId);
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(project, null, 2), "utf8");
  await fs.rename(tmp, file); // atomic — a concurrent read never sees a torn file
  return project;
}

/** Whole-project write, serialized behind the project lock. */
export async function writeAdProject(data: unknown): Promise<AdProject> {
  const project = parseAdProject(data);
  return withProjectLock(project.projectId, () => writeAdProjectUnlocked(project));
}

export async function readAdProject(projectId: string): Promise<AdProject> {
  return parseAdProject(JSON.parse(await fs.readFile(projectFile(projectId), "utf8")));
}

export async function listAdProjects(): Promise<AdProject[]> {
  let stamps: string[] = [];
  try {
    stamps = (await fs.readdir(AD_ROOT, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
  const out: AdProject[] = [];
  for (const ts of stamps) {
    try {
      out.push(await readAdProject(path.posix.join("ad", ts)));
    } catch {
      /* skip unreadable/invalid */
    }
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Append a finished render (newest-first history + latest pointer). */
export async function addAdRender(projectId: string, relPath: string): Promise<AdProject> {
  return mutateAdProject(projectId, (project) => {
    project.latestRender = relPath;
    project.renderHistory = [{ path: relPath, createdAt: new Date().toISOString() }, ...(project.renderHistory ?? [])];
  });
}

/** Delete one render: drop from history, fix the latest pointer, unlink the file. */
export async function removeAdRender(projectId: string, relPath: string): Promise<AdProject> {
  return mutateAdProject(projectId, async (project) => {
    project.renderHistory = (project.renderHistory ?? []).filter((r) => r.path !== relPath);
    if (project.latestRender === relPath) project.latestRender = project.renderHistory[0]?.path ?? null;
    try {
      await fs.unlink(safeOutputsPath(relPath.replace(/^outputs\//, "")));
    } catch {
      /* already gone — keep the metadata removal */
    }
  });
}
