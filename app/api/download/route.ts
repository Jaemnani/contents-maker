// GET /api/download?url=...&name=...&inline=1
// Proxy a remote file through our origin. OpenRouter video URLs require the API key
// (they 401 without it) and cross-origin URLs ignore <a download>, so we stream here.
import { getOpenRouterKey } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const url = sp.get("url");
  const name = sp.get("name") || "download";
  const inline = sp.get("inline") === "1";
  if (!url || !/^https?:\/\//i.test(url)) {
    return new Response("invalid url", { status: 400 });
  }

  const headers: Record<string, string> = {};
  if (/^https:\/\/openrouter\.ai\//i.test(url)) {
    headers.Authorization = `Bearer ${getOpenRouterKey()}`;
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, { headers });
  } catch (e) {
    return new Response(`fetch failed: ${(e as Error).message}`, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return new Response(`upstream ${upstream.status}`, { status: 502 });
  }

  const safeName = name.replace(/[^\w.\-]/g, "_");
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"`,
      "Cache-Control": "no-store",
    },
  });
}
