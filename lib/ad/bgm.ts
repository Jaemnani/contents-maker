// BGM generation for ad projects via a fal.ai text-to-music model (async queue):
// submit → poll → download the audio → save under the project + point audio.bgm at it.
import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { FAL_QUEUE, falHeaders, falToError } from "@/lib/fal/client";
import { getAdMusicModel } from "@/lib/env";
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

export async function generateAdBgm(projectId: string, prompt: string): Promise<AdProject> {
  if (!prompt.trim()) throw new Error("BGM 프롬프트가 비어 있습니다.");
  const project = await readAdProject(projectId);
  const model = getAdMusicModel();
  // size to the video length, clamped to a sane range (most text-to-music caps near ~47s).
  const seconds = Math.min(47, Math.max(10, estimateSeconds(project)));

  // submit
  const submit = await fetch(`${FAL_QUEUE}/${model}`, {
    method: "POST",
    headers: falHeaders(),
    body: JSON.stringify({ prompt: prompt.trim(), seconds_total: seconds }),
  });
  if (!submit.ok) throw await falToError(submit);
  const sub = (await submit.json()) as { request_id: string; status_url?: string; response_url?: string };
  const base = `${appBase(model)}/requests/${encodeURIComponent(sub.request_id)}`;
  const statusUrl = sub.status_url || `${base}/status`;
  const responseUrl = sub.response_url || base;

  // poll until completed
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
  const out = await rres.json();
  const url = pickAudioUrl(out);
  if (!url) throw new Error("BGM 결과 오디오 URL을 찾지 못했습니다.");

  // download + persist
  const dl = await fetch(url);
  if (!dl.ok) throw new Error(`BGM 다운로드 실패 (${dl.status})`);
  const buf = Buffer.from(await dl.arrayBuffer());
  const ext = (url.split("?")[0].match(/\.(mp3|wav|ogg|m4a|flac)$/i)?.[1] ?? "mp3").toLowerCase();
  const audioDirAbs = path.join(projectDirAbs(projectId), "audio");
  const fileName = `bgm-gen-${sub.request_id.slice(0, 8)}.${ext}`;
  await fs.mkdir(audioDirAbs, { recursive: true });
  await fs.writeFile(path.join(audioDirAbs, fileName), buf);
  const relPath = path.posix.join("outputs", "results", projectId, "audio", fileName);

  // delta write — re-read so concurrent edits aren't clobbered
  const fresh = await readAdProject(projectId);
  fresh.audio = { ...fresh.audio, bgm: { kind: "upload", path: relPath } };
  return writeAdProject(fresh);
}
