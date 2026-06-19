// POST /api/render — render a composition to muted 1080×1920 mp4(s) via Remotion.
// SSE progress per language. ffmpeg-free (Remotion bundles its own).
import { z } from "zod";
import pLimit from "p-limit";
import { renderRemotion } from "@/lib/render-remotion/engine";
import { readComposition } from "@/lib/post/composition";
import type { Language } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 600;

const limit = pLimit(1);

const Body = z.object({
  compId: z.string().min(1),
  languages: z.array(z.enum(["ko", "ja", "en"])).optional(),
});

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
        const comp = await readComposition(body.compId);
        const langs: Language[] = body.languages?.length ? body.languages : comp.renderLanguages;
        if (!langs.length) throw new Error("렌더할 언어가 없습니다.");
        const renders: Partial<Record<Language, string>> = {};
        for (const lang of langs) {
          send({ type: "lang-start", language: lang });
          const rel = await limit(() =>
            renderRemotion(body.compId, lang, assetBase, ({ progress, stage }) =>
              send({ type: "progress", language: lang, phase: stage, pct: Math.round(progress * 100) })
            )
          );
          renders[lang] = rel;
          send({ type: "lang-done", language: lang, path: rel });
        }
        send({ type: "done", renders });
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
