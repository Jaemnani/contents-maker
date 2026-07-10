// POST /api/ad/page-image — generate an AI image for an ad page (9:16), save to the
// shared sources/ pool and set it as the page source (mirrors /api/post/stage-bg).
import { z } from "zod";
import { generateImageSources } from "@/lib/post/source-gen";
import { readAdProject, mutateAdProject } from "@/lib/ad/store";
import { SLOT_SOURCE_FIELD, SLOT_PROMPT_FIELD, aspectOf } from "@/lib/ad/schema";
import { FalError } from "@/lib/fal/client";
import { WsError } from "@/lib/ws/client";
import { OpenRouterError } from "@/lib/openrouter/client";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  projectId: z.string(),
  pageId: z.string(),
  model: z.string(),
  prompt: z.string().min(1),
  slot: z.enum(["A", "B", "C", "D"]).optional(), // media slot; default "A"
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
    const snapshot = await readAdProject(p.projectId);
    if (!snapshot.pages.some((x) => x.id === p.pageId)) throw new Error("페이지를 찾을 수 없습니다.");
    const { refs, errors } = await generateImageSources({
      language: "ko",
      prompt: p.prompt,
      models: [p.model],
      aspect: aspectOf(snapshot.meta.width, snapshot.meta.height),
    });
    const ref = refs[0];
    if (!ref) throw new Error(errors[0]?.error || "이미지 생성 실패");
    // DELTA write behind the project lock: generation takes 10-60s — patch only this
    // page's slot so edits saved meanwhile aren't clobbered by a stale snapshot.
    const saved = await mutateAdProject(p.projectId, (fresh) => {
      const page = fresh.pages.find((x) => x.id === p.pageId);
      if (!page) return;
      const slot = p.slot ?? "A";
      page[SLOT_SOURCE_FIELD[slot]] = { kind: "asset", ref };
      page[SLOT_PROMPT_FIELD[slot]] = p.prompt;
      // compare-2up: stamp the generating model's name into that side's A/B label
      if (page.visualTemplateId === "compare-2up" && ref.label) {
        if (slot === "A") page.compareLabelA = ref.label;
        else if (slot === "B") page.compareLabelB = ref.label;
      }
    });
    return Response.json({ project: saved, ref });
  } catch (e) {
    const status =
      e instanceof FalError || e instanceof WsError || e instanceof OpenRouterError
        ? (e as { status: number }).status
        : 500;
    return fail(e, status);
  }
}
