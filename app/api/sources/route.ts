// GET /api/sources?modality=image|video&samePromptAs=&model=&aspect=&q=
// Flattened source assets for the history picker (+ same-prompt constraint).
import { listAssets, listPrompts, listModels } from "@/lib/post/assets";
import type { SourceType } from "@/lib/composition-types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const modality = (sp.get("modality") || "image") as SourceType;
  try {
    const assets = await listAssets(modality, {
      samePromptAs: sp.get("samePromptAs") ?? undefined,
      model: sp.get("model") ?? undefined,
      aspect: sp.get("aspect") ?? undefined,
      q: sp.get("q") ?? undefined,
      since: sp.get("since") ?? undefined,
    });
    const [prompts, models] = await Promise.all([listPrompts(modality), listModels(modality)]);
    return Response.json({ assets, prompts, models });
  } catch (e) {
    return Response.json({ error: { message: (e as Error).message, status: 500 } }, { status: 500 });
  }
}
