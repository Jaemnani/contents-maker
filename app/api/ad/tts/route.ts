// POST /api/ad/tts { projectId, pageId } — generate/reuse one page's VO.
// The client batch-orchestrates sequentially; server pLimit(2) guards the quota.
import { z } from "zod";
import pLimit from "p-limit";
import { ttsPage } from "@/lib/ad/tts";

export const runtime = "nodejs";
export const maxDuration = 120;

const limit = pLimit(2);

const Body = z.object({ projectId: z.string(), pageId: z.string() });

export async function POST(req: Request) {
  let p: z.infer<typeof Body>;
  try {
    p = Body.parse(await req.json());
  } catch (e) {
    return Response.json({ error: { message: (e as Error).message, status: 400 } }, { status: 400 });
  }
  try {
    const project = await limit(() => ttsPage(p.projectId, p.pageId));
    return Response.json({ project });
  } catch (e) {
    return Response.json({ error: { message: (e as Error).message, status: 500 } }, { status: 500 });
  }
}
