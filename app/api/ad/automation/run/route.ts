// POST /api/ad/automation/run { configId } -> run one config's full pipeline now.
// Long-running (compose → images → TTS → BGM → render). Serialized so concurrent runs
// (e.g. the runner firing multiple due configs) don't fight over the renderer.
import { z } from "zod";
import pLimit from "p-limit";
import { listConfigs, runAutomation } from "@/lib/ad/automation";

export const runtime = "nodejs";
export const maxDuration = 600;

const limit = pLimit(1);
const Body = z.object({ configId: z.string().min(1) });

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return Response.json({ error: { message: (e as Error).message, status: 400 } }, { status: 400 });
  }
  const assetBase = new URL(req.url).origin;
  try {
    const cfg = (await listConfigs()).find((c) => c.id === body.configId);
    if (!cfg) return Response.json({ error: { message: "설정을 찾을 수 없습니다.", status: 404 } }, { status: 404 });
    const result = await limit(() => runAutomation(cfg, assetBase));
    return Response.json({ result });
  } catch (e) {
    return Response.json({ error: { message: (e as Error).message, status: 500 } }, { status: 500 });
  }
}
