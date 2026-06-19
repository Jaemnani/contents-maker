// GET /api/file?path=outputs/... — stream a local outputs/ file (images/videos/mp4) for
// in-app preview. Path is guarded against traversal via safeOutputsPath.
import { promises as fs } from "fs";
import path from "path";
import { safeOutputsPath } from "@/lib/storage";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

export async function GET(req: Request) {
  const rel = new URL(req.url).searchParams.get("path");
  if (!rel) return new Response("missing path", { status: 400 });
  let abs: string;
  try {
    abs = safeOutputsPath(rel);
  } catch {
    return new Response("forbidden", { status: 403 });
  }
  try {
    const buf = await fs.readFile(abs);
    const type = MIME[path.extname(abs).toLowerCase()] || "application/octet-stream";
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": type, "Cache-Control": "private, max-age=60" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
