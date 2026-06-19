// POST /api/ad/compose { projectId } — LLM-draft pages for the project (replaces
// project.pages; endcard/bgm/product kept). Returns { project, warnings, model }.
import { z } from "zod";
import { composeAdPages } from "@/lib/ad/compose";
import { readAdProject, writeAdProject } from "@/lib/ad/store";
import { OpenRouterError } from "@/lib/openrouter/client";

export const runtime = "nodejs";
export const maxDuration = 180;

const Body = z.object({ projectId: z.string() });

export async function POST(req: Request) {
  let p: z.infer<typeof Body>;
  try {
    p = Body.parse(await req.json());
  } catch (e) {
    return Response.json({ error: { message: (e as Error).message, status: 400 } }, { status: 400 });
  }
  try {
    const snapshot = await readAdProject(p.projectId);
    const { pages, warnings, model } = await composeAdPages(snapshot);
    if (!pages.length) throw new Error("대본 생성에 실패했습니다. 다시 시도해 주세요.");
    // DELTA write: the LLM call takes seconds — re-read and replace ONLY pages so
    // product/endcard/BGM edits saved meanwhile aren't clobbered.
    const fresh = await readAdProject(p.projectId);
    fresh.pages = pages;
    const saved = await writeAdProject(fresh);
    return Response.json({ project: saved, warnings, model });
  } catch (e) {
    const status = e instanceof OpenRouterError ? e.status : 500;
    return Response.json({ error: { message: (e as Error).message, status } }, { status });
  }
}
