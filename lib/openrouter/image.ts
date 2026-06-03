// Image generation helper: chat/completions with modalities:["image","text"].
import "server-only";
import { OPENROUTER_BASE, authHeaders, toError } from "@/lib/openrouter/client";
import { IMAGE_OVERLAY_GUIDANCE, LANGUAGE_NAMES } from "@/lib/channels";
import type { Language } from "@/lib/types";

export function buildImagePrompt(prompt: string, language: Language, enhance: boolean): string {
  // Aspect ratio is set via the image_config param (not prompt text).
  if (!enhance) return prompt; // 원본: send verbatim
  return [
    prompt,
    IMAGE_OVERLAY_GUIDANCE,
    `Any text in the image should be written in ${LANGUAGE_NAMES[language]}.`,
  ].join("\n");
}

interface OrImage {
  type?: string;
  image_url?: { url?: string };
}
interface ImageResponse {
  choices?: { message?: { content?: string; images?: OrImage[] } }[];
  usage?: { cost?: number };
}

export interface ImageGenResult {
  dataUrls: string[];
  text: string;
  cost: number | null;
}

export async function generateImage(opts: {
  model: string;
  prompt: string;
  aspect: string;
  language: Language;
  enhance: boolean;
  signal?: AbortSignal;
}): Promise<ImageGenResult> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    signal: opts.signal,
    body: JSON.stringify({
      model: opts.model,
      modalities: ["image", "text"],
      image_config: { aspect_ratio: opts.aspect },
      messages: [{ role: "user", content: buildImagePrompt(opts.prompt, opts.language, opts.enhance) }],
    }),
  });
  if (!res.ok) throw await toError(res);
  const json = (await res.json()) as ImageResponse;
  const msg = json.choices?.[0]?.message;
  const dataUrls = (msg?.images ?? [])
    .map((im) => im.image_url?.url)
    .filter((u): u is string => typeof u === "string" && u.startsWith("data:"));
  return {
    dataUrls,
    text: msg?.content ?? "",
    cost: typeof json.usage?.cost === "number" ? json.usage.cost : null,
  };
}
