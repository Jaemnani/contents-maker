// LLM "skill": turn raw trend terms into short-form comparison-topic candidates.
// Clusters/dedupes/filters/ranks, then crafts headline/sub (ko/ja/en) + a comparePrompt.
import "server-only";
import { z } from "zod";
import { OPENROUTER_BASE, authHeaders, toError } from "@/lib/openrouter/client";
import { parseJsonLoose as parseJson } from "@/lib/openrouter/json";
import { MODELS_BY_ID, CHEAPEST_PRESETS } from "@/lib/models";
import { LANGUAGE_NAMES } from "@/lib/channels";
import type { Language } from "@/lib/types";
import type { TrendItem } from "@/lib/trends/types";

const Lt = z.object({ ko: z.string().optional(), ja: z.string().optional(), en: z.string().optional() });
const Candidate = z.object({
  term: z.string(),
  headline: Lt,
  sub: Lt,
  comparePrompt: z.string(),
  why: z.string().optional(),
});
export type TopicCandidate = z.infer<typeof Candidate>;

const cheapestTextModel = (): string => {
  const uid = CHEAPEST_PRESETS.text?.[0];
  return (uid && MODELS_BY_ID[uid]?.id) || "mistralai/ministral-8b-2512";
};

function systemPrompt(language: Language, max: number): string {
  const L = LANGUAGE_NAMES[language];
  return [
    'You are an editor for a short-form video channel whose format is "Same prompt, Different AI":',
    "one image/video prompt is fed to multiple AI models and viewers vote which result is better.",
    "Given a list of raw trending terms/headlines, do the following:",
    "1) Cluster near-duplicates and drop low-signal, sensitive, or non-visual items (politics, scandals, tragedies, pure text news).",
    "2) Keep only terms that make a VISUALLY interesting AI image/video comparison.",
    `3) Rank by short-form potential and return the top ${max}.`,
    "For each candidate produce EXACTLY these fields, keeping every string SHORT:",
    '- "term": the source keyword.',
    '- "headline": { "ko","ja","en" } punchy hook, <=10 words each.',
    '- "sub": { "ko","ja","en" } ONE short question, <=8 words each (e.g. "어느 쪽이 더 좋아?").',
    '- "comparePrompt": ONE vivid English image-gen prompt describing a SINGLE scene/subject (NOT two variants — the same prompt is fed to every model), no text in image, <=30 words.',
    `- "why": one short reason in ${L}, <=15 words.`,
    'Output ONLY this JSON object (no prose, no code fences):',
    '{"candidates":[{"term":"...","headline":{"ko":"...","ja":"...","en":"..."},"sub":{"ko":"...","ja":"...","en":"..."},"comparePrompt":"...","why":"..."}]}',
  ].join("\n");
}

const pick = (o: Record<string, unknown>, ...keys: string[]): unknown => {
  for (const k of keys) if (o[k] != null) return o[k];
  return undefined;
};

// Models drift on field names (headlines/prompt/keyword) — normalize before validation.
function normalize(c: unknown): unknown {
  if (!c || typeof c !== "object") return c;
  const o = c as Record<string, unknown>;
  return {
    term: pick(o, "term", "keyword", "topic", "title"),
    headline: pick(o, "headline", "headlines", "hook"),
    sub: pick(o, "sub", "subtitle", "question", "sub_headline"),
    comparePrompt: pick(o, "comparePrompt", "compare_prompt", "prompt", "imagePrompt"),
    why: pick(o, "why", "reason"),
  };
}

export async function curateTopics(terms: string[], language: Language, max = 6, signal?: AbortSignal): Promise<TopicCandidate[]> {
  if (!terms.length) return [];
  const model = cheapestTextModel();
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    signal,
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt(language, max) },
        { role: "user", content: JSON.stringify(terms.slice(0, 40)) },
      ],
    }),
  });
  if (!res.ok) throw await toError(res);
  const json = await res.json();
  const content: string = json.choices?.[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = parseJson(content);
  } catch {
    return [];
  }
  // LLMs sometimes return a single object (or numeric-keyed map) for "candidates" —
  // degrade gracefully instead of throwing "not iterable" and 500-ing the request.
  const rawCands = (parsed as { candidates?: unknown })?.candidates;
  const arr: unknown[] = Array.isArray(rawCands)
    ? rawCands
    : Array.isArray(parsed)
      ? (parsed as unknown[])
      : rawCands && typeof rawCands === "object"
        ? [rawCands]
        : [];
  const out: TopicCandidate[] = [];
  for (const c of arr) {
    const r = Candidate.safeParse(normalize(c));
    if (r.success) out.push(r.data);
  }
  return out.slice(0, max);
}

/** Convenience: curate from TrendItems. */
export const curateFromTrends = (items: TrendItem[], language: Language, max = 6) =>
  curateTopics(items.map((i) => i.term), language, max);
