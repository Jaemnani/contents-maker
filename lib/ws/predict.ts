// Shared WaveSpeed predict (submit) + poll helpers for image/video.
import "server-only";
import { WS_API_BASE, wsHeaders, wsToError } from "@/lib/ws/client";

export interface WsSubmitOut {
  taskId: string;
  pollUrl: string;
}

export async function wsSubmit(
  model: string,
  input: Record<string, unknown>,
  signal?: AbortSignal
): Promise<WsSubmitOut> {
  const res = await fetch(`${WS_API_BASE}/${model}`, {
    method: "POST",
    headers: wsHeaders(),
    signal,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await wsToError(res);
  const json = await res.json();
  const data = json.data ?? json;
  const pollUrl: string = data?.urls?.get || `${WS_API_BASE}/predictions/${data.id}/result`;
  return { taskId: data.id, pollUrl };
}

export interface WsPollOut {
  status: string; // created | processing | completed | failed
  outputs?: string[];
  error?: string;
}

export async function wsPoll(pollUrl: string, signal?: AbortSignal): Promise<WsPollOut> {
  const res = await fetch(pollUrl, { headers: wsHeaders(), signal });
  if (!res.ok) throw await wsToError(res);
  const json = await res.json();
  const d = json.data ?? json;
  return { status: d.status, outputs: d.outputs, error: d.error };
}
