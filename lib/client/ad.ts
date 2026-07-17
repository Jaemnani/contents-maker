// Client-side API helpers for the ad maker (browser fetch wrappers).
"use client";
import type { AdProject, FactorySource, FactoryTopic, FormatKind } from "@/lib/ad/schema";

async function jsonOrThrow(res: Response) {
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d?.error) throw new Error(d?.error?.message || `HTTP ${res.status}`);
  return d;
}

// ── automation ─────────────────────────────────────────────────────────────────
export interface AutoSteps {
  text: boolean;
  image: boolean;
  tts: boolean;
  bgm: boolean;
  render: boolean;
}
export interface AutoConfig {
  id: string;
  name: string;
  templateProjectId: string;
  enabled: boolean;
  dailyCount: number;
  topicProvider: string;
  topicKeyword: string;
  imageModel: string; // default model uid ("" = cheapest)
  regen: string[]; // "pageIndex:slotKey" of slots to regenerate (rest reuse template image)
  slotModels: Record<string, string>; // per-slot model override
  slotLinks: Record<string, string>; // "i:slot" copies the image of another "j:slot"
  steps: AutoSteps;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
}
export interface AutoRunResult {
  projectId: string;
  topic: string;
  steps: string[];
  warnings: string[];
  renderPath: string | null;
}

export async function listAutoConfigs(): Promise<AutoConfig[]> {
  return (await jsonOrThrow(await fetch("/api/ad/automation"))).configs ?? [];
}
export async function saveAutoConfig(cfg: Partial<AutoConfig>): Promise<AutoConfig> {
  return (
    await jsonOrThrow(
      await fetch("/api/ad/automation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) })
    )
  ).config;
}
export async function deleteAutoConfig(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/ad/automation?id=${encodeURIComponent(id)}`, { method: "DELETE" }));
}
export async function runAutoConfig(configId: string): Promise<AutoRunResult> {
  return (
    await jsonOrThrow(
      await fetch("/api/ad/automation/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ configId }) })
    )
  ).result;
}

const post = (body: unknown) =>
  fetch("/api/ad/project", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export async function createAdProject(opts: { preset?: "tapnow-9beat" | "empty"; topic?: string; seedPrompt?: string }): Promise<AdProject> {
  return (await jsonOrThrow(await post({ op: "create", ...opts }))).project;
}

export async function saveAdProject(project: AdProject): Promise<AdProject> {
  return (await jsonOrThrow(await post({ op: "save", project }))).project;
}

export async function getAdProject(projectId: string): Promise<AdProject> {
  return (await jsonOrThrow(await fetch(`/api/ad/project?projectId=${encodeURIComponent(projectId)}`))).project;
}

export async function listAdProjects(): Promise<AdProject[]> {
  return (await jsonOrThrow(await fetch("/api/ad/project"))).projects ?? [];
}

// ── 뉴스 쇼츠 (aib.vote/news → 컷 구성) ─────────────────────────────────────────
export interface NewsItem {
  id: string;
  title: string;
  summary: string[];
  details?: string;
  source: string;
  articleUrl?: string;
  aibUrl: string;
  publishedAt: string;
  keywords: string[];
}

export async function fetchTodayNews(): Promise<{ items: NewsItem[]; date: string }> {
  const d = await jsonOrThrow(await fetch("/api/ad/news"));
  return { items: d.items ?? [], date: d.date ?? "" };
}

export async function composeNewsShorts(
  projectId: string,
  body: { mode: "brief" | "ai_react"; items: NewsItem[]; aibEndcard: boolean }
): Promise<{ project: AdProject; warnings: string[] }> {
  const d = await jsonOrThrow(
    await fetch("/api/ad/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, ...body }),
    })
  );
  return { project: d.project, warnings: d.warnings ?? [] };
}

// ── aib content factory (decision 제출 — stage 전이 후 프로젝트 반환) ────────────
export type FactoryOpBody =
  | { op: "candidates" }
  | { op: "topic"; topic: FactoryTopic }
  | { op: "formats"; selected: FormatKind[] }
  | { op: "source"; source: FactorySource }
  | { op: "package" }
  | { op: "published" }
  | { op: "reset" };

export async function factoryOp(projectId: string, body: FactoryOpBody): Promise<AdProject> {
  const d = await jsonOrThrow(
    await fetch("/api/ad/factory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, ...body }),
    })
  );
  return d.project;
}

/** LLM-draft pages (replaces project.pages). Returns the saved project + coercion warnings. */
export async function composeAd(projectId: string): Promise<{ project: AdProject; warnings: string[] }> {
  const d = await jsonOrThrow(
    await fetch("/api/ad/compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    })
  );
  return { project: d.project, warnings: d.warnings ?? [] };
}

/** Generate (or regenerate) one page's VO via TTS. */
export async function ttsAdPage(projectId: string, pageId: string): Promise<AdProject> {
  const d = await jsonOrThrow(
    await fetch("/api/ad/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, pageId }),
    })
  );
  return d.project;
}

/** Generate (or regenerate) the ENDCARD's VO via TTS. */
export async function ttsAdEndcard(projectId: string): Promise<AdProject> {
  const d = await jsonOrThrow(
    await fetch("/api/ad/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, endcard: true }),
    })
  );
  return d.project;
}

/** Generate background music (fal text-to-music) and attach it. Returns the updated project. */
export async function generateAdBgm(projectId: string, prompt: string): Promise<AdProject> {
  const d = await jsonOrThrow(
    await fetch("/api/ad/bgm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, prompt }),
    })
  );
  return d.project;
}

/** Delete one rendered video (file + history entry). Returns the updated project. */
export async function deleteAdRender(projectId: string, path: string): Promise<AdProject> {
  const d = await jsonOrThrow(
    await fetch(`/api/ad/render?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(path)}`, {
      method: "DELETE",
    })
  );
  return d.project;
}

export type AdRenderEvent =
  | { type: "lang-start"; language: string }
  | { type: "progress"; phase: string; pct?: number; language?: string }
  | { type: "lang-done"; language: string; path: string }
  | { type: "done"; renders: Record<string, string> }
  | { type: "error"; message: string };

/** Stream an ad render via SSE; resolves when the stream closes. */
export async function streamAdRender(projectId: string, onEvent: (e: AdRenderEvent) => void): Promise<void> {
  const res = await fetch("/api/ad/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d?.error?.message || `렌더 요청 실패 (HTTP ${res.status})`);
  }
  if (!res.body) throw new Error("렌더 스트림을 열 수 없습니다.");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      try {
        onEvent(JSON.parse(line.slice(5).trim()) as AdRenderEvent);
      } catch {
        /* ignore malformed */
      }
    }
  }
}
