// POST /api/post/stage-bg — generate a stage background image (start/end card bg, or the
// main background) from a prompt. Saved to sources/ and set as stage.image (source="ai").
import { z } from "zod";
import { generateImageSources } from "@/lib/post/source-gen";
import { readComposition, writeComposition } from "@/lib/post/composition";
import { FalError } from "@/lib/fal/client";
import { WsError } from "@/lib/ws/client";
import { OpenRouterError } from "@/lib/openrouter/client";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  compId: z.string(),
  stageId: z.enum(["start", "main", "end"]),
  model: z.string(),
  prompt: z.string().min(1),
  aspect: z.string().optional(),
});

const fail = (e: unknown, status: number) =>
  Response.json({ error: { message: (e as Error).message, status } }, { status });

export async function POST(req: Request) {
  let p: z.infer<typeof Body>;
  try {
    p = Body.parse(await req.json());
  } catch (e) {
    return fail(e, 400);
  }
  try {
    const comp = await readComposition(p.compId);
    const stage = comp.stages.find((s) => s.id === p.stageId);
    if (!stage) throw new Error("단계를 찾을 수 없습니다.");

    // When textMode is "in-image", bake the card copy into the generation prompt so the
    // model draws the text (overlay is then skipped at render time).
    let genPrompt = p.prompt;
    if (stage.textMode === "in-image" && p.stageId !== "main") {
      const lang = comp.primaryLanguage;
      const pick = (lt?: { ko?: string; ja?: string; en?: string }) => lt?.[lang] ?? lt?.ko ?? lt?.en ?? lt?.ja ?? "";
      const parts: string[] = [];
      if (p.stageId === "start") {
        const h = pick(stage.headline);
        const s = pick(stage.sub);
        if (h) parts.push(`a large bold title that reads "${h}"`);
        if (s) parts.push(`a smaller subtitle that reads "${s}"`);
      } else {
        const cta = stage.elements?.find((e) => e.id === "cta");
        const c = pick(cta?.text);
        if (c) parts.push(`a large call-to-action that reads "${c}"`);
      }
      if (parts.length) {
        genPrompt = `${p.prompt}. Render this text clearly and legibly as part of the design: ${parts.join(", ")}.`;
      }
    }

    const { datasetPath, refs, errors } = await generateImageSources({
      language: comp.primaryLanguage,
      prompt: genPrompt,
      models: [p.model],
      aspect: p.aspect ?? "9:16",
    });
    const ref = refs[0];
    if (!ref) throw new Error(errors[0]?.error || "배경 이미지 생성 실패");
    stage.image = { source: "ai", ref, genModel: p.model, genPrompt: p.prompt };
    await writeComposition(comp);
    return Response.json({ composition: comp, datasetPath, ref });
  } catch (e) {
    const status =
      e instanceof FalError || e instanceof WsError || e instanceof OpenRouterError
        ? (e as { status: number }).status
        : 500;
    return fail(e, status);
  }
}
