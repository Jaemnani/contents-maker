// POST /api/generate/text — single model, 5-variant, SSE passthrough.
import { z } from "zod";
import { streamTextCompletion } from "@/lib/openrouter/text";
import { streamWsText } from "@/lib/ws/text";
import { toError, OpenRouterError } from "@/lib/openrouter/client";
import { MODELS_BY_ID } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  model: z.string(),
  prompt: z.string().min(1),
  language: z.enum(["ko", "ja", "en"]),
  maxTokens: z.number().int().positive().max(20000).optional(),
  mode: z.enum(["marketing", "raw"]).optional(),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (e) {
    return Response.json({ error: { message: (e as Error).message, status: 400 } }, { status: 400 });
  }
  const model = MODELS_BY_ID[parsed.model];
  if (!model) {
    return Response.json({ error: { message: `Unknown model: ${parsed.model}`, status: 400 } }, { status: 400 });
  }

  try {
    const args = {
      model: model.id, // raw provider id (parsed.model is the uid)
      prompt: parsed.prompt,
      language: parsed.language,
      maxTokens: parsed.maxTokens ?? 5000,
      mode: parsed.mode ?? "raw",
      signal: req.signal,
    } as const;
    const upstream = model.serving === "ws" ? await streamWsText(args) : await streamTextCompletion(args);
    if (!upstream.ok || !upstream.body) {
      const err = await toError(upstream);
      return Response.json({ error: { message: err.message, status: err.status } }, { status: err.status });
    }
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    const status = e instanceof OpenRouterError ? e.status : 500;
    return Response.json({ error: { message: (e as Error).message, status } }, { status });
  }
}
