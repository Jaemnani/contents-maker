// Text generation helper: builds the 5-variant prompt and streams chat completions.
import "server-only";
import { OPENROUTER_BASE, authHeaders } from "@/lib/openrouter/client";
import { TEXT_VARIANTS } from "@/lib/channels";
import { LANGUAGE_NAMES } from "@/lib/channels";
import type { Language, TextMode } from "@/lib/types";

export const VARIANT_DELIM = (id: string) => `=== ${id.toUpperCase()} ===`;

export function buildRawSystemPrompt(language: Language): string {
  return `You are a helpful assistant. Answer the user's request directly in ${LANGUAGE_NAMES[language]}. Do not add extra framing or sections — just the answer.`;
}

export function buildSystemPrompt(language: Language, mode: TextMode): string {
  return mode === "raw" ? buildRawSystemPrompt(language) : buildVariantSystemPrompt(language);
}

export function buildVariantSystemPrompt(language: Language): string {
  const langName = LANGUAGE_NAMES[language];
  const sections = TEXT_VARIANTS.map(
    (v) => `${VARIANT_DELIM(v.id)}\n<${v.minChars}-${v.maxChars} characters, for ${v.targetChannels.join("/")}>`
  ).join("\n");
  return [
    `You are an expert social-media marketing copywriter. Write ALL output in ${langName}.`,
    `For the user's topic, produce exactly ${TEXT_VARIANTS.length} length variants of the copy.`,
    `Output each variant preceded by its delimiter line (on its own line), in EXACTLY this order and format:`,
    sections,
    `Rules: respect each variant's character range, write engaging marketing copy in ${langName},`,
    `and output nothing outside these delimited sections.`,
  ].join("\n");
}

export async function streamTextCompletion(opts: {
  model: string;
  prompt: string;
  language: Language;
  maxTokens: number;
  mode: TextMode;
  signal?: AbortSignal;
}): Promise<Response> {
  return fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    signal: opts.signal,
    body: JSON.stringify({
      model: opts.model,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: opts.maxTokens,
      messages: [
        { role: "system", content: buildSystemPrompt(opts.language, opts.mode) },
        { role: "user", content: opts.prompt },
      ],
    }),
  });
}
