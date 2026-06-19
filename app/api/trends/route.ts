// GET /api/trends?provider=&q=&lang= → { providers, items }
// providers = key-configured sources; items = fetched trend terms (if provider given).
import { listProviders, getTrends } from "@/lib/trends";
import type { Language } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const provider = sp.get("provider");
  const q = sp.get("q") || undefined;
  const lang = (sp.get("lang") || "ko") as Language;
  const providers = listProviders();
  if (!provider) return Response.json({ providers, items: [] });
  try {
    const items = await getTrends(provider, { lang, query: q, limit: 25 });
    return Response.json({ providers, items });
  } catch (e) {
    return Response.json({ providers, items: [], error: (e as Error).message });
  }
}
