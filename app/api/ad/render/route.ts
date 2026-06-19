// POST /api/ad/render — render an ad project (with audio) via Remotion. SSE progress,
// same event shape as /api/render (language fixed to "ko" in v1).
import { z } from "zod";
import pLimit from "p-limit";
import { renderAd } from "@/lib/ad/render";
import { removeAdRender } from "@/lib/ad/store";

export const runtime = "nodejs";
export const maxDuration = 600;

const limit = pLimit(1); // renders are heavy — serialize across requests

const Body = z.object({ projectId: z.string().min(1) });

/** DELETE ?projectId=&path= — remove one render (file + history entry). */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const path = url.searchParams.get("path");
  if (!projectId || !path) {
    return Response.json({ error: { message: "projectId와 path가 필요합니다.", status: 400 } }, { status: 400 });
  }
  try {
    return Response.json({ project: await removeAdRender(projectId, path) });
  } catch (e) {
    return Response.json({ error: { message: (e as Error).message, status: 500 } }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return Response.json({ error: { message: (e as Error).message, status: 400 } }, { status: 400 });
  }
  const assetBase = new URL(req.url).origin;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj: unknown) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          /* client gone — render continues */
        }
      };
      try {
        send({ type: "lang-start", language: "ko" });
        const rel = await limit(() =>
          renderAd(body.projectId, assetBase, ({ progress, stage }) =>
            send({ type: "progress", language: "ko", phase: stage, pct: Math.round(progress * 100) })
          )
        );
        send({ type: "lang-done", language: "ko", path: rel });
        send({ type: "done", renders: { ko: rel } });
      } catch (e) {
        send({ type: "error", message: (e as Error).message });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
