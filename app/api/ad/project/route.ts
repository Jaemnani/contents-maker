// Ad project CRUD.
//   POST {op:"create", preset?, topic?}   -> { project }
//   POST {op:"save", project}             -> { project }   (zod-validated)
//   GET  ?projectId=<id>                  -> { project }
//   GET                                   -> { projects }
import { z } from "zod";
import { ZodError } from "zod";
import { createAdProject, saveAdProjectKeepFactory, readAdProject, listAdProjects } from "@/lib/ad/store";

export const runtime = "nodejs";

const CreateBody = z.object({
  op: z.literal("create"),
  preset: z.enum(["tapnow-9beat", "empty"]).optional(),
  topic: z.string().optional(),
  seedPrompt: z.string().optional(),
});
const SaveBody = z.object({
  op: z.literal("save"),
  project: z.record(z.string(), z.unknown()),
});

const err = (message: string, status: number) =>
  Response.json({ error: { message, status } }, { status });

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return err("잘못된 JSON 본문입니다.", 400);
  }
  const op = (json as { op?: string })?.op;
  try {
    if (op === "create") {
      const b = CreateBody.parse(json);
      return Response.json({ project: await createAdProject({ preset: b.preset, topic: b.topic, seedPrompt: b.seedPrompt }) });
    }
    if (op === "save") {
      const b = SaveBody.parse(json);
      // factory는 서버 소유(/api/ad/factory) — 스테일 에디터 스냅샷이 배치를 덮지 않게 보존
      return Response.json({ project: await saveAdProjectKeepFactory(b.project) });
    }
    return err(`알 수 없는 op: ${op}`, 400);
  } catch (e) {
    if (e instanceof ZodError) return err(`프로젝트 검증 실패: ${e.issues[0]?.message ?? "invalid"}`, 400);
    return err((e as Error).message, 500);
  }
}

export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get("projectId");
  try {
    if (projectId) return Response.json({ project: await readAdProject(projectId) });
    return Response.json({ projects: await listAdProjects() });
  } catch (e) {
    return err((e as Error).message, 404);
  }
}
