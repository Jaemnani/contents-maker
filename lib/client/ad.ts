// Client-side API helpers for the ad maker (browser fetch wrappers).
"use client";
import type { AdProject } from "@/lib/ad/schema";

async function jsonOrThrow(res: Response) {
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d?.error) throw new Error(d?.error?.message || `HTTP ${res.status}`);
  return d;
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
