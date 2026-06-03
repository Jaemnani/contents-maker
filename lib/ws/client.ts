// WaveSpeed client. Server-only — holds the WAVESPEED key.
// LLM: OpenAI-compatible at https://llm.wavespeed.ai/v1
// Image/Video: predict at https://api.wavespeed.ai/api/v3/{model} -> poll predictions/{id}/result
import "server-only";
import { getWaveSpeedKey } from "@/lib/env";

export const WS_LLM_BASE = "https://llm.wavespeed.ai/v1";
export const WS_API_BASE = "https://api.wavespeed.ai/api/v3";

export function wsHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${getWaveSpeedKey()}`, "Content-Type": "application/json" };
}

export class WsError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "WsError";
  }
}

export async function wsToError(res: Response): Promise<WsError> {
  let msg = `WaveSpeed ${res.status}`;
  try {
    const body = await res.json();
    msg = body?.error?.message || body?.message || body?.error || msg;
  } catch {
    try {
      msg = (await res.text()) || msg;
    } catch {
      /* ignore */
    }
  }
  return new WsError(typeof msg === "string" ? msg : JSON.stringify(msg), res.status);
}
