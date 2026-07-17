// 뉴스 쇼츠 API.
//   GET                              -> { items, date }   오늘의 aib.vote/news 기사 (오늘자 없으면 최신일)
//   POST {projectId, mode, items[], aibEndcard} -> { project, warnings }   선택 기사로 쇼츠 컷 구성
import { z } from "zod";
import { ZodError } from "zod";
import { fetchTodayAibNews } from "@/lib/news/aib-news";
import { buildNewsShorts, zNewsShortsItem } from "@/lib/ad/news-shorts";
import { FactoryFlowError } from "@/lib/ad/factory/decision";

export const runtime = "nodejs";
export const maxDuration = 180; // 크롤 + LLM 대본 1회

const Body = z.object({
  projectId: z.string(),
  mode: z.enum(["brief", "ai_react"]),
  items: z.array(zNewsShortsItem).min(1).max(5),
  aibEndcard: z.boolean().default(true),
});

const err = (message: string, status: number) =>
  Response.json({ error: { message, status } }, { status });

export async function GET() {
  try {
    const { items, date } = await fetchTodayAibNews();
    return Response.json({ items, date });
  } catch (e) {
    return err((e as Error).message, 502); // 크롤 실패 — 원인 메시지를 그대로 UI에
  }
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return err("잘못된 JSON 본문입니다.", 400);
  }
  try {
    const b = Body.parse(json);
    const { project, warnings } = await buildNewsShorts(b.projectId, b.mode, b.items, b.aibEndcard);
    return Response.json({ project, warnings });
  } catch (e) {
    if (e instanceof ZodError) return err(`요청 검증 실패: ${e.issues[0]?.message ?? "invalid"}`, 400);
    if (e instanceof FactoryFlowError) return err(e.message, 409);
    const msg = (e as Error).message ?? "";
    if (/ENOENT/.test(msg)) return err("프로젝트를 찾을 수 없습니다.", 404);
    return err(msg, 500);
  }
}
