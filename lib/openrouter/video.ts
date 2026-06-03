// Video generation helper: async submit + poll. (POST /api/v1/videos, GET /api/v1/videos/{id})
import "server-only";
import { OPENROUTER_BASE, authHeaders, toError } from "@/lib/openrouter/client";
import { VIDEO_HOOK_GUIDANCE, LANGUAGE_NAMES } from "@/lib/channels";
import type { Language, ModelEntry, VideoParams } from "@/lib/types";

const RES_ORDER = ["1080p", "720p", "480p"]; // skip 4K to avoid surprise cost

export function clampVideoParams(model: ModelEntry, p: VideoParams): VideoParams {
  const v = model.video ?? {};
  const resolution =
    v.resolutions?.length
      ? v.resolutions.includes(p.resolution)
        ? p.resolution
        : RES_ORDER.find((r) => v.resolutions!.includes(r)) ?? v.resolutions[0]
      : p.resolution;
  const aspectRatio =
    v.aspectRatios?.length
      ? v.aspectRatios.includes(p.aspectRatio)
        ? p.aspectRatio
        : v.aspectRatios[0]
      : p.aspectRatio;
  let duration = p.duration;
  if (v.durations?.length && !v.durations.includes(p.duration)) {
    const below = v.durations.filter((d) => d <= p.duration);
    duration = below.length ? Math.max(...below) : Math.min(...v.durations);
  }
  return { resolution, aspectRatio, duration, enhance: p.enhance };
}

export function buildVideoPrompt(prompt: string, language: Language, enhance: boolean): string {
  if (!enhance) return prompt; // 원본: send verbatim
  return `${prompt}\n\n${VIDEO_HOOK_GUIDANCE}\nAny on-screen text should be in ${LANGUAGE_NAMES[language]}.`;
}

export interface SubmitResult {
  jobId: string;
  status: string;
  clamped: VideoParams;
}

export async function submitVideo(opts: {
  model: ModelEntry;
  prompt: string;
  language: Language;
  params: VideoParams;
  signal?: AbortSignal;
}): Promise<SubmitResult> {
  const clamped = clampVideoParams(opts.model, opts.params);
  const res = await fetch(`${OPENROUTER_BASE}/videos`, {
    method: "POST",
    headers: authHeaders(),
    signal: opts.signal,
    body: JSON.stringify({
      model: opts.model.id,
      prompt: buildVideoPrompt(opts.prompt, opts.language, opts.params.enhance),
      aspect_ratio: clamped.aspectRatio,
      resolution: clamped.resolution,
      duration: clamped.duration,
    }),
  });
  if (!res.ok) throw await toError(res);
  const json = (await res.json()) as { id: string; status: string };
  return { jobId: json.id, status: json.status, clamped };
}

export type NormalizedStatus = "processing" | "succeeded" | "failed";

export interface PollResult {
  status: NormalizedStatus;
  rawStatus: string;
  videoUrl?: string;
  cost?: number | null;
  error?: string;
}

interface PollResponse {
  status: string;
  unsigned_urls?: string[];
  error?: string;
  usage?: { cost?: number };
}

export async function pollVideo(jobId: string, signal?: AbortSignal): Promise<PollResult> {
  const res = await fetch(`${OPENROUTER_BASE}/videos/${encodeURIComponent(jobId)}`, {
    headers: authHeaders(),
    signal,
  });
  if (!res.ok) throw await toError(res);
  const json = (await res.json()) as PollResponse;
  const raw = json.status;
  if (raw === "completed") {
    return {
      status: "succeeded",
      rawStatus: raw,
      videoUrl: json.unsigned_urls?.[0],
      cost: typeof json.usage?.cost === "number" ? json.usage.cost : null,
    };
  }
  if (raw === "failed" || raw === "cancelled" || raw === "canceled") {
    return { status: "failed", rawStatus: raw, error: json.error ?? `상태: ${raw}` };
  }
  return { status: "processing", rawStatus: raw };
}
