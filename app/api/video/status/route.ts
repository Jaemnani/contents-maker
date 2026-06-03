// GET /api/video/status?jobId=...&model=...  — poll a video job, normalized status.
// Dispatches to fal or OpenRouter based on the model's serving platform.
import { pollVideo } from "@/lib/openrouter/video";
import { pollFalVideo } from "@/lib/fal/video";
import { pollWsVideo } from "@/lib/ws/video";
import { OpenRouterError } from "@/lib/openrouter/client";
import { FalError } from "@/lib/fal/client";
import { WsError } from "@/lib/ws/client";
import { MODELS_BY_ID } from "@/lib/models";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const jobId = sp.get("jobId");
  const modelId = sp.get("model");
  if (!jobId) {
    return Response.json({ error: { message: "jobId required", status: 400 } }, { status: 400 });
  }
  const model = modelId ? MODELS_BY_ID[modelId] : undefined;
  try {
    let out;
    if (model?.serving === "fal" && modelId) {
      out = await pollFalVideo({
        model: model.id, jobId,
        statusUrl: sp.get("su") || undefined,
        responseUrl: sp.get("ru") || undefined,
        signal: req.signal,
      });
    } else if (model?.serving === "ws") {
      out = await pollWsVideo({ jobId, pollUrl: sp.get("su") || undefined, signal: req.signal });
    } else {
      out = await pollVideo(jobId, req.signal);
    }
    return Response.json(out);
  } catch (e) {
    const status = e instanceof OpenRouterError || e instanceof FalError || e instanceof WsError ? e.status : 500;
    return Response.json({ error: { message: (e as Error).message, status } }, { status });
  }
}
