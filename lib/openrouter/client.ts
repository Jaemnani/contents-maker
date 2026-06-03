// Base OpenRouter fetch wrapper. Server-only — holds the API key.
import "server-only";
import { getOpenRouterKey, SITE_URL, SITE_NAME } from "@/lib/env";

export const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${getOpenRouterKey()}`,
    "HTTP-Referer": SITE_URL,
    "X-Title": SITE_NAME,
    "Content-Type": "application/json",
    ...extra,
  };
}

export class OpenRouterError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "OpenRouterError";
  }
}

/** Normalize an OpenRouter error response into a typed error (digs out provider detail). */
export async function toError(res: Response): Promise<OpenRouterError> {
  let msg = `OpenRouter ${res.status}`;
  try {
    const body = await res.json();
    const err = body?.error;
    msg = err?.message || body?.message || msg;
    const meta = err?.metadata;
    if (meta?.raw) {
      try {
        const raw = typeof meta.raw === "string" ? JSON.parse(meta.raw) : meta.raw;
        const inner = raw?.error?.message || raw?.message;
        if (inner) msg = inner;
      } catch {
        /* metadata.raw not JSON */
      }
    }
    if (meta?.provider_name) msg = `${msg} (${meta.provider_name})`;
  } catch {
    try {
      msg = (await res.text()) || msg;
    } catch {
      /* ignore */
    }
  }
  return new OpenRouterError(msg, res.status);
}

/** GET helper returning parsed JSON (used by /api/models hydration). */
export async function orGet<T>(path: string): Promise<T> {
  const res = await fetch(`${OPENROUTER_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) throw await toError(res);
  return (await res.json()) as T;
}
