// Client-side video generation: submit jobs (p-limit), then poll until terminal or timeout.
// Active jobs are mirrored to localStorage so an in-progress run can be recovered after reload.
import pLimit from "p-limit";
import type { GenResult, Language, VideoParams } from "@/lib/types";

const VIDEO_CONCURRENCY = 3;
const POLL_INTERVAL_MS = 3000;
const JOB_TIMEOUT_MS = 8 * 60 * 1000; // 8 min (concern #3: OpenRouter queue can exceed 5 min)
const LS_KEY = "cm_video_jobs";

export interface ActiveJob {
  model: string;
  jobId: string;
  submittedAt: number;
  prompt: string;
  language: Language;
  params: VideoParams;
  statusUrl?: string; // fal: queue status URL from submit
  responseUrl?: string; // fal: queue result URL from submit
}

export function readActiveJobs(): ActiveJob[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as ActiveJob[]) : [];
  } catch {
    return [];
  }
}
function writeActiveJobs(jobs: ActiveJob[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(jobs));
  } catch {
    /* ignore quota/availability */
  }
}
function removeJob(jobId: string) {
  writeActiveJobs(readActiveJobs().filter((j) => j.jobId !== jobId));
}
export function clearActiveJobs() {
  writeActiveJobs([]);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RunVideoOpts {
  models: string[];
  prompt: string;
  language: Language;
  params: VideoParams;
  onUpdate: (model: string, patch: Partial<GenResult>) => void;
  signal?: AbortSignal;
}

export async function runVideoGeneration(opts: RunVideoOpts): Promise<void> {
  const limit = pLimit(VIDEO_CONCURRENCY);
  const active = new Map<string, ActiveJob>(); // model -> job

  // 1) submit
  await Promise.allSettled(
    opts.models.map((model) =>
      limit(async () => {
        opts.onUpdate(model, { status: "loading" });
        try {
          const res = await fetch("/api/video/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              prompt: opts.prompt,
              language: opts.language,
              resolution: opts.params.resolution,
              aspectRatio: opts.params.aspectRatio,
              duration: opts.params.duration,
              enhance: opts.params.enhance,
            }),
            signal: opts.signal,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
          const job: ActiveJob = {
            model,
            jobId: data.jobId,
            submittedAt: Date.now(),
            prompt: opts.prompt,
            language: opts.language,
            params: opts.params,
            statusUrl: data.statusUrl,
            responseUrl: data.responseUrl,
          };
          active.set(model, job);
          writeActiveJobs([...readActiveJobs().filter((j) => j.model !== model), job]);
          // fal returns the (computed) cost at submit; OpenRouter returns it on poll.
          opts.onUpdate(model, { status: "processing", jobId: data.jobId, actualCost: data.cost ?? null });
        } catch (e) {
          let msg = (e as Error).message;
          if (/upload_url|Zero Data Retention/i.test(msg)) {
            msg = "이 영상 모델은 ZDR(무보존) 전용이라 별도 업로드 설정이 필요합니다. Veo·Seedance·Kling 등 다른 영상 모델을 사용하세요.";
          }
          opts.onUpdate(model, { status: "error", error: msg });
        }
      })
    )
  );

  // 2) poll
  await pollLoop(active, opts.onUpdate, opts.signal);
}

/** Poll a set of active jobs until each is terminal (or times out). Shared by run + resume. */
async function pollLoop(
  active: Map<string, ActiveJob>,
  onUpdate: (model: string, patch: Partial<GenResult>) => void,
  signal?: AbortSignal
): Promise<void> {
  while (active.size > 0 && !signal?.aborted) {
    await sleep(POLL_INTERVAL_MS);
    if (signal?.aborted) break;
    await Promise.allSettled(
      [...active.values()].map(async (job) => {
        if (Date.now() - job.submittedAt > JOB_TIMEOUT_MS) {
          onUpdate(job.model, { status: "error", error: "타임아웃(8분 초과)" });
          active.delete(job.model);
          removeJob(job.jobId);
          return;
        }
        try {
          const extra =
            (job.statusUrl ? `&su=${encodeURIComponent(job.statusUrl)}` : "") +
            (job.responseUrl ? `&ru=${encodeURIComponent(job.responseUrl)}` : "");
          const res = await fetch(
            `/api/video/status?jobId=${encodeURIComponent(job.jobId)}&model=${encodeURIComponent(job.model)}${extra}`,
            { signal }
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
          if (data.status === "succeeded") {
            // OpenRouter returns cost on poll; fal already set it at submit -> keep existing if poll has none.
            const patch: Partial<GenResult> = {
              status: "done",
              videoUrl: data.videoUrl,
              ms: Date.now() - job.submittedAt,
            };
            if (data.cost != null) patch.actualCost = data.cost;
            onUpdate(job.model, patch);
            active.delete(job.model);
            removeJob(job.jobId);
          } else if (data.status === "failed") {
            onUpdate(job.model, { status: "error", error: data.error ?? "생성 실패" });
            active.delete(job.model);
            removeJob(job.jobId);
          }
          // else processing: keep polling
        } catch {
          // transient poll error: keep the job, retry next tick
        }
      })
    );
  }
}

/** Resume polling jobs persisted in localStorage (e.g. after a page reload). */
export async function resumeVideoGeneration(opts: {
  jobs: ActiveJob[];
  onUpdate: (model: string, patch: Partial<GenResult>) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const active = new Map<string, ActiveJob>();
  for (const j of opts.jobs) {
    active.set(j.model, j);
    opts.onUpdate(j.model, { status: "processing", jobId: j.jobId });
  }
  await pollLoop(active, opts.onUpdate, opts.signal);
}
