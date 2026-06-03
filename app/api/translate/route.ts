// POST /api/translate — translate a short copy string into target languages using the
// cheapest available text model. Used to auto-fill ko/ja/en card/CTA copy.
import { z } from "zod";
import { OPENROUTER_BASE, authHeaders, toError, OpenRouterError } from "@/lib/openrouter/client";
import { LANGUAGE_NAMES } from "@/lib/channels";
import { MODELS_BY_ID, CHEAPEST_PRESETS } from "@/lib/models";
import type { Language } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  text: z.string().min(1),
  from: z.enum(["ko", "ja", "en"]),
  to: z.array(z.enum(["ko", "ja", "en"])).min(1),
});

const cheapestTextModel = (): string => {
  const uid = CHEAPEST_PRESETS.text?.[0];
  return (uid && MODELS_BY_ID[uid]?.id) || "deepseek/deepseek-v4-flash";
};

async function translateOne(model: string, text: string, from: Language, to: Language, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    signal,
    body: JSON.stringify({
      model,
      max_tokens: 400,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `Translate the short UI/marketing caption from ${LANGUAGE_NAMES[from]} to ${LANGUAGE_NAMES[to]}. Keep it punchy and natural for short-form video. Output ONLY the translation — no quotes, no notes.`,
        },
        { role: "user", content: text },
      ],
    }),
  });
  if (!res.ok) throw await toError(res);
  const json = await res.json();
  return (json.choices?.[0]?.message?.content ?? "").trim();
}

export async function POST(req: Request) {
  let p: z.infer<typeof Body>;
  try {
    p = Body.parse(await req.json());
  } catch (e) {
    return Response.json({ error: { message: (e as Error).message, status: 400 } }, { status: 400 });
  }
  try {
    const model = cheapestTextModel();
    const translations: Partial<Record<Language, string>> = {};
    for (const lang of p.to) {
      if (lang === p.from) {
        translations[lang] = p.text;
        continue;
      }
      translations[lang] = (await translateOne(model, p.text, p.from, lang, req.signal)) || p.text;
    }
    return Response.json({ translations, model });
  } catch (e) {
    const status = e instanceof OpenRouterError ? e.status : 500;
    return Response.json({ error: { message: (e as Error).message, status } }, { status });
  }
}
