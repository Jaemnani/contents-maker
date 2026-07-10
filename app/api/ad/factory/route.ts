// aib 콘텐츠 팩토리 decision 엔드포인트 (AUTOMATION.md §3).
//   POST {projectId, op:"topic"|"formats"|"source"|"package"|"published"|"reset", ...} -> { project }
// 사람(UI)의 선택을 input으로 받아 stage를 전이시킨다. L2+의 러너도 같은 resolveDecision을 부른다.
import { z } from "zod";
import { ZodError } from "zod";
import { zFactorySource, zFactoryTopic, zFormatKind } from "@/lib/ad/schema";
import { resolveDecision, type FactoryInput } from "@/lib/ad/factory/decision";

export const runtime = "nodejs";
export const maxDuration = 300; // package는 LLM 4회 체인 (골자→채널→쇼츠→팩트체크)

const Body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("topic"), projectId: z.string(), topic: zFactoryTopic }),
  z.object({ op: z.literal("formats"), projectId: z.string(), selected: z.array(zFormatKind).min(1) }),
  z.object({ op: z.literal("source"), projectId: z.string(), source: zFactorySource }),
  z.object({ op: z.literal("package"), projectId: z.string() }),
  z.object({ op: z.literal("published"), projectId: z.string() }),
  z.object({ op: z.literal("reset"), projectId: z.string() }),
]);

const err = (message: string, status: number) =>
  Response.json({ error: { message, status } }, { status });

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return err("잘못된 JSON 본문입니다.", 400);
  }
  try {
    const b = Body.parse(json);
    const { projectId, ...input } = b;
    const project = await resolveDecision(projectId, input as FactoryInput);
    return Response.json({ project });
  } catch (e) {
    if (e instanceof ZodError) return err(`요청 검증 실패: ${e.issues[0]?.message ?? "invalid"}`, 400);
    return err((e as Error).message, 500);
  }
}
