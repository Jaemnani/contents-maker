// POST /api/upload — multipart upload (e.g. a logo). Saves under outputs/uploads/ (or a
// composition's uploads/ when compId is provided). Returns the outputs/-relative path.
import { saveUpload } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: { message: "file 필드가 필요합니다.", status: 400 } }, { status: 400 });
    }
    const compId = form.get("compId");
    const baseRel = typeof compId === "string" && compId ? `outputs/results/${compId}/uploads` : "outputs/uploads";
    const buf = Buffer.from(await file.arrayBuffer());
    const path = await saveUpload(buf, file.name || "upload.png", baseRel);
    return Response.json({ path });
  } catch (e) {
    return Response.json({ error: { message: (e as Error).message, status: 500 } }, { status: 500 });
  }
}
