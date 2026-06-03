// WaveSpeed LLM (OpenAI-compatible) streaming.
import "server-only";
import { WS_LLM_BASE, wsHeaders } from "@/lib/ws/client";
import { buildSystemPrompt } from "@/lib/openrouter/text";
import type { Language, TextMode } from "@/lib/types";

export async function streamWsText(opts: {
  model: string;
  prompt: string;
  language: Language;
  maxTokens: number;
  mode: TextMode;
  signal?: AbortSignal;
}): Promise<Response> {
  return fetch(`${WS_LLM_BASE}/chat/completions`, {
    method: "POST",
    headers: wsHeaders(),
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
