// Client-side API helpers for the wizard. (Browser fetch wrappers.)
"use client";
import type { Composition, AssetRef, SourceType, LocalizedText } from "@/lib/composition-types";
import type { Language } from "@/lib/types";
import type { TrendItem } from "@/lib/trends/types";

async function jsonOrThrow(res: Response) {
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d?.error) throw new Error(d?.error?.message || `HTTP ${res.status}`);
  return d;
}

/** outputs/-relative path -> in-app file URL. */
export const fileUrl = (rel: string) => `/api/file?path=${encodeURIComponent(rel)}`;
export const assetUrl = (a: { datasetPath: string; file: string }) => fileUrl(`${a.datasetPath}/${a.file}`);
export const assetThumbUrl = (a: AssetRef) =>
  a.thumb ? fileUrl(`${a.datasetPath}/${a.thumb}`) : assetUrl(a);

export async function createComposition(sourceType: SourceType, primaryLanguage: Language, topicId?: string): Promise<Composition> {
  const d = await jsonOrThrow(
    await fetch("/api/post/composition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "create", sourceType, primaryLanguage, topicId }),
    })
  );
  return d.composition;
}

export async function saveComposition(composition: Composition): Promise<Composition> {
  const d = await jsonOrThrow(
    await fetch("/api/post/composition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "save", composition }),
    })
  );
  return d.composition;
}

export async function listCompositions(): Promise<Composition[]> {
  const d = await jsonOrThrow(await fetch("/api/post/composition"));
  return d.compositions ?? [];
}

export async function getComposition(compId: string): Promise<Composition> {
  const d = await jsonOrThrow(await fetch(`/api/post/composition?compId=${encodeURIComponent(compId)}`));
  return d.composition;
}

export async function comparePair(args: {
  compId: string; prompt: string; language: Language; modelA: string; modelB: string; aspect?: string;
}): Promise<{ composition: Composition; datasetPath: string }> {
  return jsonOrThrow(
    await fetch("/api/post/compare-pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    })
  );
}

export async function generateStageBg(args: {
  compId: string; stageId: "start" | "main" | "end"; model: string; prompt: string; aspect?: string;
}): Promise<{ composition: Composition; ref: AssetRef }> {
  return jsonOrThrow(
    await fetch("/api/post/stage-bg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    })
  );
}

export async function uploadFile(file: File, compId?: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  if (compId) fd.append("compId", compId);
  const d = await jsonOrThrow(await fetch("/api/upload", { method: "POST", body: fd }));
  return d.path;
}

export async function translateText(text: string, from: Language, to: Language[]): Promise<Partial<Record<Language, string>>> {
  const d = await jsonOrThrow(
    await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, from, to }),
    })
  );
  return d.translations ?? {};
}

export type SourceAsset = AssetRef;
export async function listSources(modality: SourceType, opts: { samePromptAs?: string; model?: string; q?: string } = {}): Promise<{
  assets: AssetRef[]; prompts: { prompt: string; count: number }[]; models: string[];
}> {
  const sp = new URLSearchParams({ modality });
  if (opts.samePromptAs != null) sp.set("samePromptAs", opts.samePromptAs);
  if (opts.model) sp.set("model", opts.model);
  if (opts.q) sp.set("q", opts.q);
  return jsonOrThrow(await fetch(`/api/sources?${sp.toString()}`));
}

// ---- Trend → topic suggestion ----
export interface TrendProviderInfo { id: string; label: string; }
export interface TopicCandidate {
  term: string;
  headline: LocalizedText;
  sub: LocalizedText;
  comparePrompt: string;
  why?: string;
}

/** List configured trend providers (key-gated). */
export async function listTrendProviders(lang: Language): Promise<TrendProviderInfo[]> {
  const d = await jsonOrThrow(await fetch(`/api/trends?lang=${lang}`));
  return d.providers ?? [];
}

/** Fetch trend terms from a provider (optional seed keyword). */
export async function fetchTrends(provider: string, lang: Language, query?: string): Promise<{ items: TrendItem[]; error?: string }> {
  const sp = new URLSearchParams({ provider, lang });
  if (query) sp.set("q", query);
  const d = await jsonOrThrow(await fetch(`/api/trends?${sp.toString()}`));
  return { items: d.items ?? [], error: d.error };
}

/** LLM-curate trend terms into comparison-topic candidates. */
export async function curateTopics(args: { terms?: string[]; term?: string; language: Language; max?: number }): Promise<TopicCandidate[]> {
  const d = await jsonOrThrow(
    await fetch("/api/topic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    })
  );
  return d.candidates ?? [];
}

export type RenderEvent =
  | { type: "lang-start"; language: Language }
  | { type: "progress"; phase: string; pct?: number; language?: Language }
  | { type: "lang-done"; language: Language; path: string }
  | { type: "done"; renders: Partial<Record<Language, string>> }
  | { type: "error"; message: string };

/** Stream a render via SSE; calls onEvent for each event. Resolves when the stream closes. */
export async function streamRender(compId: string, languages: Language[], onEvent: (e: RenderEvent) => void): Promise<void> {
  const res = await fetch("/api/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ compId, languages }),
  });
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
        onEvent(JSON.parse(line.slice(5).trim()) as RenderEvent);
      } catch {
        /* ignore malformed */
      }
    }
  }
}
