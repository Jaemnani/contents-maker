// WaveSpeed video generation (async predict + poll).
import "server-only";
import { wsSubmit, wsPoll } from "@/lib/ws/predict";
import { WS_DEFS_BY_ID } from "@/lib/ws/models";
import { buildVideoPrompt } from "@/lib/openrouter/video";
import type { Language, VideoParams } from "@/lib/types";
import type { PollResult } from "@/lib/openrouter/video";

export interface WsVideoSubmit {
  jobId: string;
  status: string;
  cost: number | null;
  pollUrl: string;
}

export async function submitWsVideo(opts: {
  model: string;
  prompt: string;
  language: Language;
  params: VideoParams;
  signal?: AbortSignal;
}): Promise<WsVideoSubmit> {
  const def = WS_DEFS_BY_ID[opts.model];
  if (!def) throw new Error(`Unknown WS video model: ${opts.model}`);
  let dur = opts.params.duration;
  if (def.durations?.length && !def.durations.includes(dur)) {
    const below = def.durations.filter((d) => d <= dur);
    dur = below.length ? Math.max(...below) : Math.min(...def.durations);
  }
  const input: Record<string, unknown> = { prompt: buildVideoPrompt(opts.prompt, opts.language, opts.params.enhance), duration: dur };
  if (def.aspectRatios?.length) {
    input.aspect_ratio = def.aspectRatios.includes(opts.params.aspectRatio) ? opts.params.aspectRatio : def.aspectRatios[0];
  }
  const { taskId, pollUrl } = await wsSubmit(opts.model, input, opts.signal);
  return { jobId: taskId, status: "created", cost: def.perSecond != null ? def.perSecond * dur : null, pollUrl };
}

export async function pollWsVideo(opts: {
  jobId: string;
  pollUrl?: string;
  signal?: AbortSignal;
}): Promise<PollResult> {
  const url = opts.pollUrl || `https://api.wavespeed.ai/api/v3/predictions/${opts.jobId}/result`;
  const r = await wsPoll(url, opts.signal);
  if (r.status === "completed") {
    return { status: "succeeded", rawStatus: r.status, videoUrl: r.outputs?.[0], cost: null };
  }
  if (r.status === "failed") {
    return { status: "failed", rawStatus: r.status, error: r.error || "생성 실패" };
  }
  return { status: "processing", rawStatus: r.status };
}
