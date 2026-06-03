// fal.ai video generation (async queue): submit -> poll status -> fetch result.
import "server-only";
import { FAL_QUEUE, falHeaders, falToError } from "@/lib/fal/client";
import { FAL_DEFS_BY_ID, type FalModelDef } from "@/lib/fal/models";
import { buildVideoPrompt } from "@/lib/openrouter/video";
import type { Language, VideoParams } from "@/lib/types";
import type { PollResult } from "@/lib/openrouter/video";

function buildInput(def: FalModelDef, prompt: string, params: VideoParams) {
  const input: Record<string, unknown> = { prompt };
  // duration — only models that expose it
  let dur = params.duration;
  if (def.durations?.length) {
    if (!def.durations.includes(dur)) {
      const below = def.durations.filter((d) => d <= dur);
      dur = below.length ? Math.max(...below) : Math.min(...def.durations);
    }
    input.duration = def.durationFormat === "Ns" ? `${dur}s` : `${dur}`;
  }
  // aspect — only models with an aspect_ratio param
  if (def.aspectRatios?.length) {
    input.aspect_ratio = def.aspectRatios.includes(params.aspectRatio) ? params.aspectRatio : def.aspectRatios[0];
  }
  // resolution — dimension-string map (Ovi) or standard enum
  if (def.falResolutionByAspect) {
    input.resolution = def.falResolutionByAspect[params.aspectRatio] ?? Object.values(def.falResolutionByAspect)[0];
  } else if (def.resolutions?.length) {
    input.resolution = def.resolutions.includes(params.resolution)
      ? params.resolution
      : def.resolutions.includes("1080p") ? "1080p" : def.resolutions[0];
  }
  if (def.generateAudio) input.generate_audio = true;
  return { input, clampedDuration: dur };
}

export interface FalSubmitResult {
  jobId: string;
  status: string;
  cost: number | null;
  statusUrl: string;
  responseUrl: string;
}

// status/result URLs use the app id (first 2 path segments), not the full submit sub-path.
function appBase(model: string): string {
  return `${FAL_QUEUE}/${model.split("/").slice(0, 2).join("/")}`;
}

export async function submitFalVideo(opts: {
  model: string;
  prompt: string;
  language: Language;
  params: VideoParams;
  signal?: AbortSignal;
}): Promise<FalSubmitResult> {
  const def = FAL_DEFS_BY_ID[opts.model];
  if (!def) throw new Error(`Unknown fal video model: ${opts.model}`);
  const prompt = buildVideoPrompt(opts.prompt, opts.language, opts.params.enhance);
  const { input, clampedDuration } = buildInput(def, prompt, opts.params);

  const res = await fetch(`${FAL_QUEUE}/${opts.model}`, {
    method: "POST",
    headers: falHeaders(),
    signal: opts.signal,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await falToError(res);
  const json = (await res.json()) as {
    request_id: string; status?: string; status_url?: string; response_url?: string;
  };
  const cost =
    def.falPerVideo != null ? def.falPerVideo : def.falPerSecond != null ? def.falPerSecond * clampedDuration : null;
  const base = `${appBase(opts.model)}/requests/${encodeURIComponent(json.request_id)}`;
  return {
    jobId: json.request_id,
    status: json.status ?? "IN_QUEUE",
    cost,
    statusUrl: json.status_url ?? `${base}/status`,
    responseUrl: json.response_url ?? base,
  };
}

export async function pollFalVideo(opts: {
  model: string;
  jobId: string;
  statusUrl?: string;
  responseUrl?: string;
  signal?: AbortSignal;
}): Promise<PollResult> {
  const base = `${appBase(opts.model)}/requests/${encodeURIComponent(opts.jobId)}`;
  const statusUrl = opts.statusUrl || `${base}/status`;
  const responseUrl = opts.responseUrl || base;
  const sres = await fetch(statusUrl, { headers: falHeaders(), signal: opts.signal });
  if (!sres.ok) throw await falToError(sres);
  const s = (await sres.json()) as { status: string };
  if (s.status !== "COMPLETED") {
    return { status: "processing", rawStatus: s.status };
  }
  const rres = await fetch(responseUrl, { headers: falHeaders(), signal: opts.signal });
  if (!rres.ok) throw await falToError(rres);
  const out = (await rres.json()) as { video?: { url?: string }; error?: string };
  const url = out?.video?.url;
  if (!url) return { status: "failed", rawStatus: s.status, error: out?.error ?? "결과에 영상 URL 없음" };
  return { status: "succeeded", rawStatus: s.status, videoUrl: url, cost: null };
}
