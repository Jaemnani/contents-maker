// POST /api/ad/bgm — generate background music for an ad project (fal text-to-music).
//   { projectId, prompt } -> { project }
import { z } from "zod";
import pLimit from "p-limit";
import { generateAdBgm } from "@/lib/ad/bgm";
import { FalError } from "@/lib/fal/client";

export const runtime = "nodejs";
export const maxDuration = 300;

const limit = pLimit(1); // music gen is heavy — serialize across requests

const Body = z.object({ projectId: z.string().min(1), prompt: z.string().min(1) });

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return Response.json({ error: { message: (e as Error).message, status: 400 } }, { status: 400 });
  }
  try {
    const project = await limit(() => generateAdBgm(body.projectId, body.prompt));
    return Response.json({ project });
  } catch (e) {
    const status = e instanceof FalError ? e.status : 500;
    return Response.json({ error: { message: (e as Error).message, status } }, { status });
  }
}
