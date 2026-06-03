// Composition CRUD for the wizard.
//   POST {op:"create", sourceType, primaryLanguage, topicId?}  -> { composition }
//   POST {op:"save", composition}                              -> { composition }
//   GET  ?compId=<id>                                          -> { composition }
//   GET                                                        -> { compositions }
import { z } from "zod";
import { createComposition, writeComposition, readComposition, listCompositions } from "@/lib/post/composition";
import type { Composition } from "@/lib/composition-types";

export const runtime = "nodejs";

const CreateBody = z.object({
  op: z.literal("create"),
  sourceType: z.enum(["image", "video"]),
  primaryLanguage: z.enum(["ko", "ja", "en"]),
  topicId: z.string().optional(),
});
const SaveBody = z.object({
  op: z.literal("save"),
  composition: z.record(z.string(), z.unknown()),
});

const fail = (e: unknown, status = 500) =>
  Response.json({ error: { message: (e as Error).message, status } }, { status });

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch (e) {
    return fail(e, 400);
  }
  try {
    const op = (json as { op?: string }).op;
    if (op === "create") {
      const b = CreateBody.parse(json);
      const composition = await createComposition({
        sourceType: b.sourceType,
        primaryLanguage: b.primaryLanguage,
        topicId: b.topicId,
      });
      return Response.json({ composition });
    }
    if (op === "save") {
      const b = SaveBody.parse(json);
      const comp = b.composition as unknown as Composition;
      if (!comp.compId) return fail(new Error("compId 누락"), 400);
      await writeComposition(comp);
      return Response.json({ composition: comp });
    }
    return fail(new Error(`unknown op: ${op}`), 400);
  } catch (e) {
    return fail(e, 400);
  }
}

export async function GET(req: Request) {
  const compId = new URL(req.url).searchParams.get("compId");
  try {
    if (compId) return Response.json({ composition: await readComposition(compId) });
    return Response.json({ compositions: await listCompositions() });
  } catch (e) {
    return fail(e, 404);
  }
}
