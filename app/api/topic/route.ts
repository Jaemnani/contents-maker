// POST /api/topic { terms?|term, language, max? } → { candidates }
// LLM curation: trend terms → short-form comparison-topic candidates (headline/sub/comparePrompt).
import { z } from "zod";
import { curateTopics } from "@/lib/topic/curate";
import { OpenRouterError } from "@/lib/openrouter/client";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  terms: z.array(z.string()).optional(),
  term: z.string().optional(),
  language: z.enum(["ko", "ja", "en"]),
  max: z.number().int().min(1).max(12).optional(),
});

export async function POST(req: Request) {
  let p: z.infer<typeof Body>;
  try {
    p = Body.parse(await req.json());
  } catch (e) {
    return Response.json({ error: { message: (e as Error).message, status: 400 } }, { status: 400 });
  }
  const terms = p.terms ?? (p.term ? [p.term] : []);
  if (!terms.length) return Response.json({ error: { message: "terms 또는 term이 필요합니다.", status: 400 } }, { status: 400 });
  try {
    const candidates = await curateTopics(terms, p.language, p.max ?? 6, req.signal);
    return Response.json({ candidates });
  } catch (e) {
    const status = e instanceof OpenRouterError ? e.status : 500;
    return Response.json({ error: { message: (e as Error).message, status } }, { status });
  }
}
