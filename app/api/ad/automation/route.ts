// Ad automation configs CRUD.
//   GET                  -> { configs }
//   POST { ...config }   -> { config }   (create/update)
//   DELETE ?id=          -> { ok }
import { listConfigs, saveConfig, deleteConfig } from "@/lib/ad/automation";

export const runtime = "nodejs";

const err = (message: string, status: number) => Response.json({ error: { message, status } }, { status });

export async function GET() {
  try {
    return Response.json({ configs: await listConfigs() });
  } catch (e) {
    return err((e as Error).message, 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    return Response.json({ config: await saveConfig(body) });
  } catch (e) {
    return err((e as Error).message, 400);
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return err("id가 필요합니다.", 400);
  try {
    await deleteConfig(id);
    return Response.json({ ok: true });
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
