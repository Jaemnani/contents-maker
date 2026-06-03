// POST /api/image — single model × single aspect. Returns base64 data URLs.
import { z } from "zod";
import { generateImage } from "@/lib/openrouter/image";
import { generateFalImage } from "@/lib/fal/image";
import { generateWsImage } from "@/lib/ws/image";
import { OpenRouterError } from "@/lib/openrouter/client";
import { FalError } from "@/lib/fal/client";
import { WsError } from "@/lib/ws/client";
import { MODELS_BY_ID } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  model: z.string(),
  prompt: z.string().min(1),
  language: z.enum(["ko", "ja", "en"]),
  aspect: z.string(),
  resolution: z.enum(["1k", "2k"]).default("1k"),
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
  if (!model) {
    return Response.json({ error: { message: `Unknown model: ${parsed.model}`, status: 400 } }, { status: 400 });
  }
  const start = Date.now();
  try {
    const args = { ...parsed, model: model.id, enhance: parsed.enhance ?? false, signal: req.signal };
    if (model.serving === "fal") {
      const out = await generateFalImage(args);
      return Response.json({
        model: parsed.model, aspect: parsed.aspect, images: out.urls, text: "", cost: out.cost, ms: Date.now() - start,
      });
    }
    if (model.serving === "ws") {
      const out = await generateWsImage(args);
      return Response.json({
        model: parsed.model, aspect: parsed.aspect, images: out.urls, text: "", cost: out.cost, ms: Date.now() - start,
      });
    }
    const out = await generateImage(args);
    return Response.json({
      model: parsed.model, aspect: parsed.aspect, images: out.dataUrls, text: out.text, cost: out.cost, ms: Date.now() - start,
    });
  } catch (e) {
    const status = e instanceof OpenRouterError || e instanceof FalError || e instanceof WsError ? e.status : 500;
    return Response.json({ error: { message: (e as Error).message, status } }, { status });
  }
}
