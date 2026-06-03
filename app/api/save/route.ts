// POST /api/save — persist a generation batch as a source folder under outputs/sources/.
import { z } from "zod";
import { saveSourceBatch } from "@/lib/storage";
import type { GenResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  contentType: z.enum(["text", "image", "video"]),
  language: z.enum(["ko", "ja", "en"]),
  prompt: z.string(),
  // params kept for client compatibility; not persisted in the source index
  params: z.record(z.string(), z.unknown()).optional(),
  results: z.array(z.record(z.string(), z.unknown())),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (e) {
    return Response.json({ error: { message: (e as Error).message, status: 400 } }, { status: 400 });
  }
  try {
    const outcome = await saveSourceBatch({
      type: parsed.contentType,
      language: parsed.language,
      prompt: parsed.prompt,
      results: parsed.results as unknown as GenResult[],
    });
    return Response.json(outcome);
  } catch (e) {
    return Response.json({ error: { message: (e as Error).message, status: 500 } }, { status: 500 });
  }
}
