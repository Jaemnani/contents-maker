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
    const total = buf.length;
    // Range support — HTML <video> (looping bg clips) needs it to seek without a full download.
    const range = req.headers.get("range");
    const m = range && /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1;
      if (start > end || start >= total) {
        return new Response("range not satisfiable", { status: 416, headers: { "Content-Range": `bytes */${total}` } });
      }
      const slice = buf.subarray(start, end + 1);
      return new Response(new Uint8Array(slice), {
        status: 206,
        headers: {
          "Content-Type": type,
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(slice.length),
          "Cache-Control": "private, max-age=60",
        },
      });
    }
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": String(total), "Cache-Control": "private, max-age=60" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
