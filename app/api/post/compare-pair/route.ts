// POST /api/post/compare-pair — generate the main A/B comparison from ONE prompt + two
// image models. Both saved into a single source folder (same-prompt set) and set as
// main.aRef/bRef on the composition.
import { z } from "zod";
import { generateImageSources } from "@/lib/post/source-gen";
import { readComposition, writeComposition } from "@/lib/post/composition";
import { FalError } from "@/lib/fal/client";
import { WsError } from "@/lib/ws/client";
import { OpenRouterError } from "@/lib/openrouter/client";

export const runtime = "nodejs";
export const maxDuration = 180;

const Body = z.object({
  compId: z.string(),
  prompt: z.string().min(1),
  language: z.enum(["ko", "ja", "en"]),
  modelA: z.string(),
  modelB: z.string(),
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
  if (p.modelA === p.modelB) return fail(new Error("서로 다른 두 모델을 선택하세요."), 400);
  try {
    const { datasetPath, refs, errors } = await generateImageSources({
      language: p.language,
      prompt: p.prompt,
      models: [p.modelA, p.modelB],
      aspect: p.aspect ?? "9:16",
    });
    const aRef = refs.find((r) => r.modelUid === p.modelA);
    const bRef = refs.find((r) => r.modelUid === p.modelB);
    if (!aRef || !bRef) {
      const msg = errors.map((e) => `${e.model}: ${e.error}`).join(" / ") || "이미지 생성 실패";
      throw new Error(msg);
    }
    const comp = await readComposition(p.compId);
    const main = comp.stages.find((s) => s.id === "main");
    if (!main) throw new Error("본론 단계가 없습니다.");
    main.aRef = aRef;
    main.bRef = bRef;
    main.aLabel = aRef.label;
    main.bLabel = bRef.label;
    await writeComposition(comp);
    return Response.json({ composition: comp, datasetPath, errors });
  } catch (e) {
    const status =
      e instanceof FalError || e instanceof WsError || e instanceof OpenRouterError
        ? (e as { status: number }).status
        : 500;
    return fail(e, status);
  }
}
