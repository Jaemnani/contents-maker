// Client-side text generation runner: fan-out one SSE request per model (p-limit), parse, report.
import pLimit from "p-limit";
import { parseVariants } from "@/lib/variants";
import type { GenResult, Language, TextMode } from "@/lib/types";

const TEXT_CONCURRENCY = 5;

interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number;
}

export interface RunTextOpts {
  models: string[];
  prompt: string;
  language: Language;
  maxTokens: number;
  mode: TextMode;
  onUpdate: (model: string, patch: Partial<GenResult>) => void;
  /** compute USD from usage when OpenRouter doesn't include cost directly */
  computeCost?: (model: string, usage: Usage) => number | null;
  signal?: AbortSignal;
}

export async function runTextGeneration(opts: RunTextOpts): Promise<void> {
  const limit = pLimit(TEXT_CONCURRENCY);
  await Promise.allSettled(
    opts.models.map((model) =>
      limit(async () => {
        const start = performance.now();
        opts.onUpdate(model, { status: "loading" });
        try {
          const res = await fetch("/api/generate/text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              prompt: opts.prompt,
              language: opts.language,
              maxTokens: opts.maxTokens,
              mode: opts.mode,
            }),
            signal: opts.signal,
          });
          if (!res.ok || !res.body) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.error?.message || `HTTP ${res.status}`);
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let raw = "";
          let buffer = "";
          let usage: Usage | null = null;
          opts.onUpdate(model, { status: "streaming", raw: "" });

          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              const t = line.trim();
              if (!t.startsWith("data:")) continue;
              const data = t.slice(5).trim();
              if (data === "[DONE]") continue;
              let json: {
                error?: { message?: string };
                choices?: { delta?: { content?: string } }[];
                usage?: Usage;
              };
              try {
                json = JSON.parse(data);
              } catch {
                continue; // skip any partial/non-JSON line
              }
              if (json.error) throw new Error(json.error.message || "stream error");
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                raw += delta;
                opts.onUpdate(model, { status: "streaming", raw });
              }
              if (json.usage) usage = json.usage;
            }
          }

          const variants = opts.mode === "raw" ? {} : parseVariants(raw);
          const ms = Math.round(performance.now() - start);
          const cost =
            typeof usage?.cost === "number"
              ? usage.cost
              : usage && opts.computeCost
                ? opts.computeCost(model, usage)
                : null;
          opts.onUpdate(model, { status: "done", raw, variants, ms, actualCost: cost });
        } catch (e) {
          if ((e as Error).name === "AbortError") {
            opts.onUpdate(model, { status: "error", error: "취소됨" });
          } else {
            opts.onUpdate(model, { status: "error", error: (e as Error).message });
          }
        }
      })
    )
  );
}
