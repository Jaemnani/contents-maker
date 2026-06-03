// fal.ai client. Server-only — holds the FAL key.
// Two endpoints: https://fal.run/{id} (sync, used for images) and
// https://queue.fal.run/{id} (async queue, used for video).
import "server-only";
import { getFalKey } from "@/lib/env";

export const FAL_SYNC = "https://fal.run";
export const FAL_QUEUE = "https://queue.fal.run";

export function falHeaders(): Record<string, string> {
  return {
    Authorization: `Key ${getFalKey()}`,
    "Content-Type": "application/json",
  };
}

export class FalError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "FalError";
  }
}

export async function falToError(res: Response): Promise<FalError> {
  let msg = `fal ${res.status}`;
  try {
    const body = await res.json();
    // fal errors: { detail: "..."} or { detail: [{msg,...}] } or { message }
    if (typeof body?.detail === "string") msg = body.detail;
    else if (Array.isArray(body?.detail)) msg = body.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join("; ") || msg;
    else if (body?.message) msg = body.message;
  } catch {
    try {
      msg = (await res.text()) || msg;
    } catch {
      /* ignore */
    }
  }
  return new FalError(msg, res.status);
}
