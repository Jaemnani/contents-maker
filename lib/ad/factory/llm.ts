// 팩토리 공용 LLM 호출 — compose.ts 컨벤션 그대로 (OpenRouter, json_object, zod 단일 경계).
import "server-only";
import type { z } from "zod";
import { OPENROUTER_BASE, authHeaders, toError } from "@/lib/openrouter/client";
import { parseJsonLoose } from "@/lib/openrouter/json";
import { getAdComposeModel } from "@/lib/env";

export async function factoryLlm<S extends z.ZodType>(schema: S, sys: string, user: string, maxTokens = 6000): Promise<z.infer<S>> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: getAdComposeModel(),
      max_tokens: maxTokens,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw await toError(res);
  const json = await res.json();
  const content: string = json.choices?.[0]?.message?.content ?? "";
  return schema.parse(parseJsonLoose(content));
}
