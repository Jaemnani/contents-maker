// 팩토리 공용 LLM 호출 — compose.ts 컨벤션 그대로 (OpenRouter, json_object, zod 단일 경계).
import "server-only";
import type { z } from "zod";
import { OPENROUTER_BASE, authHeaders, toError } from "@/lib/openrouter/client";
import { parseJsonLoose } from "@/lib/openrouter/json";
import { getAdComposeModel } from "@/lib/env";

// 형식 드리프트/일시 장애 1회 재시도 — 비싼 다단계 체인이 마지막 파싱 한 번에 무너지지 않게.
export async function factoryLlm<S extends z.ZodType>(schema: S, sys: string, user: string, maxTokens = 6000): Promise<z.infer<S>> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: authHeaders(),
      signal: AbortSignal.timeout(120_000), // 행 걸린 호출이 라우트 maxDuration까지 붙잡지 않게
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
    if (!res.ok) {
      const err = await toError(res);
      if (attempt === 0 && (res.status >= 500 || res.status === 429)) {
        lastErr = err;
        continue; // 일시 장애만 재시도 — 4xx(키/요청 오류)는 즉시 실패
      }
      throw err;
    }
    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? "";
    try {
      return schema.parse(parseJsonLoose(content));
    } catch (e) {
      lastErr = e; // 형식 드리프트 — 한 번 더
    }
  }
  throw new Error(`LLM 출력 형식 오류 — 다시 시도해 주세요. (${(lastErr as Error)?.message?.slice(0, 120) ?? "unknown"})`);
}
