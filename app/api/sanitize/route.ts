// POST /api/sanitize — rewrite a generation prompt to pass provider content filters
// (esp. Google's child-safety / Responsible AI). Returns the rewritten prompt.
import { z } from "zod";
import { OPENROUTER_BASE, authHeaders, toError, OpenRouterError } from "@/lib/openrouter/client";
import { LANGUAGE_NAMES } from "@/lib/channels";
import type { Language } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Cheap, reliable, instruction-following model for the rewrite task.
// (deepseek-v4-flash paid — ~4.5x cheaper than gpt-5.4-nano; :free is too unstable.)
const SANITIZE_MODEL = "deepseek/deepseek-v4-flash";

const Body = z.object({
  prompt: z.string().min(1),
  language: z.enum(["ko", "ja", "en"]),
});

function systemPrompt(language: Language): string {
  return [
    "You rewrite prompts for AI image/video generation so they pass provider content filters",
    "(especially Google's Responsible AI / child-safety policy).",
    "Rules:",
    "- Remove or replace references to minors/children/teens. Prefer removing the person and focusing on the object/scene/action, or use an unspecified adult.",
    "- Remove references to real or identifiable people, celebrities, brand names/logos, violence, gore, sexual or hateful content.",
    "- Preserve the original creative intent, subject, style, setting, and mood as much as possible.",
    `- Write the rewritten prompt in ${LANGUAGE_NAMES[language]}.`,
    "- Output ONLY the rewritten prompt text — no preamble, quotes, or explanation.",
  ].join("\n");
}

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (e) {
    return Response.json({ error: { message: (e as Error).message, status: 400 } }, { status: 400 });
  }
  try {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: authHeaders(),
      signal: req.signal,
      body: JSON.stringify({
        model: SANITIZE_MODEL,
        max_tokens: 600,
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt(parsed.language) },
          { role: "user", content: parsed.prompt },
        ],
      }),
    });
    if (!res.ok) throw await toError(res);
    const json = await res.json();
    const sanitized: string = (json.choices?.[0]?.message?.content ?? "").trim();
    // Fall back to the original if the model returned nothing usable.
    return Response.json({ sanitized: sanitized || parsed.prompt, model: SANITIZE_MODEL });
  } catch (e) {
    const status = e instanceof OpenRouterError ? e.status : 500;
    return Response.json({ error: { message: (e as Error).message, status } }, { status });
  }
}
