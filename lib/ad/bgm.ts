// BGM generation for ad projects. Provider auto-selected (fal text-to-music / Gemini Lyria)
// from whichever key is configured. Saves the audio under the project + points audio.bgm at it.
import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { FAL_QUEUE, falHeaders, falToError } from "@/lib/fal/client";
import { getAdMusicModel, getAdMusicProvider, hasFalKey, hasGeminiKey } from "@/lib/env";
import { geminiMusic } from "@/lib/gemini/audio";
import { readAdProject, writeAdProject, projectDirAbs } from "@/lib/ad/store";
import type { AdProject } from "@/lib/ad/schema";

/** Rough video length in seconds (ignores transition overlaps — BGM loops anyway). */
function estimateSeconds(project: AdProject): number {
  const pageSec = project.pages.reduce(
    (a, p) => a + (p.durationOverrideSec ?? p.voAudio?.durationSec ?? 3),
    0
  );
  const ecSec = project.endcard.enabled ? project.endcard.durationSec ?? 3 : 0;
  return Math.round(pageSec + ecSec);
}

const POLL_MS = 2500;
const MAX_WAIT_MS = 180_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// status/result URLs use the app id (first 2 path segments), not the submit sub-path.
const appBase = (model: string) => `${FAL_QUEUE}/${model.split("/").slice(0, 2).join("/")}`;

/** Pull an audio URL out of whatever shape the music model returns. */
function pickAudioUrl(out: unknown): string | undefined {
  const o = out as Record<string, unknown>;
  const candidates = [
    (o?.audio_file as { url?: string })?.url,
    (o?.audio as { url?: string })?.url,
    o?.audio_url as string,
    typeof o?.audio === "string" ? (o.audio as string) : undefined,
  ];
  return candidates.find((u): u is string => typeof u === "string" && u.length > 0);
}

/** Save an audio buffer under the project and point audio.bgm at it (delta write). */
async function attachBgm(projectId: string, buffer: Buffer, ext: string, tag: string): Promise<AdProject> {
  const audioDirAbs = path.join(projectDirAbs(projectId), "audio");
  const fileName = `bgm-gen-${tag}.${ext}`;
  await fs.mkdir(audioDirAbs, { recursive: true });
  await fs.writeFile(path.join(audioDirAbs, fileName), buffer);
  // drop stale generated BGMs so they don't accumulate on disk
  try {
    for (const f of await fs.readdir(audioDirAbs)) {
      if (f.startsWith("bgm-gen-") && f !== fileName) await fs.unlink(path.join(audioDirAbs, f));
    }
  } catch {
    /* best-effort cleanup */
  }
  const relPath = path.posix.join("outputs", "results", projectId, "audio", fileName);
  // re-read so concurrent edits aren't clobbered
  const fresh = await readAdProject(projectId);
  fresh.audio = { ...fresh.audio, bgm: { kind: "upload", path: relPath } };
  return writeAdProject(fresh);
}

/** fal.ai async-queue text-to-music: submit → poll → download. */
async function falMusic(prompt: string, seconds: number): Promise<{ buffer: Buffer; ext: string; tag: string }> {
  const model = getAdMusicModel();
  const submit = await fetch(`${FAL_QUEUE}/${model}`, {
    method: "POST",
    headers: falHeaders(),
    body: JSON.stringify({ prompt, seconds_total: seconds }),
  });
  if (!submit.ok) throw await falToError(submit);
  const sub = (await submit.json()) as { request_id: string; status_url?: string; response_url?: string };
  const base = `${appBase(model)}/requests/${encodeURIComponent(sub.request_id)}`;
  const statusUrl = sub.status_url || `${base}/status`;
  const responseUrl = sub.response_url || base;

  const deadline = Date.now() + MAX_WAIT_MS;
  for (;;) {
    if (Date.now() > deadline) throw new Error("BGM 생성 시간 초과 (다시 시도해 주세요).");
    await sleep(POLL_MS);
    const sres = await fetch(statusUrl, { headers: falHeaders() });
    if (!sres.ok) throw await falToError(sres);
    const s = (await sres.json()) as { status: string };
    if (s.status === "COMPLETED") break;
    if (s.status === "FAILED" || s.status === "ERROR") throw new Error("BGM 생성에 실패했습니다.");
  }

  const rres = await fetch(responseUrl, { headers: falHeaders() });
  if (!rres.ok) throw await falToError(rres);
  const url = pickAudioUrl(await rres.json());
  if (!url) throw new Error("BGM 결과 오디오 URL을 찾지 못했습니다.");
  const dl = await fetch(url);
  if (!dl.ok) throw new Error(`BGM 다운로드 실패 (${dl.status})`);
  const ext = (url.split("?")[0].match(/\.(mp3|wav|ogg|m4a|flac)$/i)?.[1] ?? "mp3").toLowerCase();
  return { buffer: Buffer.from(await dl.arrayBuffer()), ext, tag: sub.request_id.slice(0, 8) };
}

export async function generateAdBgm(projectId: string, prompt: string): Promise<AdProject> {
  if (!prompt.trim()) throw new Error("BGM 프롬프트가 비어 있습니다.");
  const project = await readAdProject(projectId);

  const explicit = getAdMusicProvider();
  const useGemini = explicit === "gemini" || (explicit !== "fal" && !hasFalKey() && hasGeminiKey());

  if (useGemini) {
    const { buffer, ext } = await geminiMusic(prompt.trim());
    return attachBgm(projectId, buffer, ext, `gem-${Math.abs(hashStr(prompt)).toString(36).slice(0, 8)}`);
  }
  // size to the video length, clamped to a sane range (most text-to-music caps near ~47s).
  const seconds = Math.min(47, Math.max(10, estimateSeconds(project)));
  const { buffer, ext, tag } = await falMusic(prompt.trim(), seconds);
  return attachBgm(projectId, buffer, ext, tag);
}

// small stable tag from the prompt (no Date.now — keeps filenames deterministic per prompt)
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
