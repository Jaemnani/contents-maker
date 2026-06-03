// POST /api/video/submit — submit async video job, returns jobId.
import { z } from "zod";
import { submitVideo } from "@/lib/openrouter/video";
import { submitFalVideo } from "@/lib/fal/video";
import { submitWsVideo } from "@/lib/ws/video";
import { OpenRouterError } from "@/lib/openrouter/client";
import { FalError } from "@/lib/fal/client";
import { WsError } from "@/lib/ws/client";
import { MODELS_BY_ID } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  model: z.string(),
  prompt: z.string().min(1),
  language: z.enum(["ko", "ja", "en"]),
  resolution: z.string(),
  aspectRatio: z.string(),
  duration: z.number().int().positive(),
  enhance: z.boolean().optional(),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (e) {
    return Response.json({ error: { message: (e as Error).message, status: 400 } }, { status: 400 });
  }
  const model = MODELS_BY_ID[parsed.model];
  if (!model || model.modality !== "video") {
    return Response.json({ error: { message: `Unknown video model: ${parsed.model}`, status: 400 } }, { status: 400 });
  }
  const params = {
    resolution: parsed.resolution,
    aspectRatio: parsed.aspectRatio,
    duration: parsed.duration,
    enhance: parsed.enhance ?? false,
  };
  try {
    if (model.serving === "fal") {
      const out = await submitFalVideo({ model: model.id, prompt: parsed.prompt, language: parsed.language, params, signal: req.signal });
      return Response.json({
        model: parsed.model, jobId: out.jobId, status: out.status, cost: out.cost,
        statusUrl: out.statusUrl, responseUrl: out.responseUrl,
      });
    }
    if (model.serving === "ws") {
      const out = await submitWsVideo({ model: model.id, prompt: parsed.prompt, language: parsed.language, params, signal: req.signal });
      return Response.json({ model: parsed.model, jobId: out.jobId, status: out.status, cost: out.cost, statusUrl: out.pollUrl });
    }
    const out = await submitVideo({ model, prompt: parsed.prompt, language: parsed.language, params, signal: req.signal });
    return Response.json({ model: parsed.model, jobId: out.jobId, status: out.status, clamped: out.clamped, cost: null });
  } catch (e) {
    const status = e instanceof OpenRouterError || e instanceof FalError || e instanceof WsError ? e.status : 500;
    return Response.json({ error: { message: (e as Error).message, status } }, { status });
  }
}
