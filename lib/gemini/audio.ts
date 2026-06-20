// Google Gemini audio generation (server-only): TTS (narration) + Lyria (BGM).
// Both use the v1beta generateContent REST endpoint with a single GEMINI_API_KEY.
// Model ids are preview/fast-moving — env-overridable (see lib/env.ts).
import "server-only";
import { getGeminiKey, getGeminiTtsModel, getGeminiTtsVoice, getGeminiMusicModel } from "@/lib/env";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface InlinePart {
  inlineData?: { data?: string; mimeType?: string };
  inline_data?: { data?: string; mime_type?: string };
}
interface GenResponse {
  candidates?: { content?: { parts?: InlinePart[] } }[];
}

/** Wrap raw 16-bit little-endian PCM in a minimal WAV container. */
function pcmToWav(pcm: Buffer, sampleRate: number, channels = 1, bitsPerSample = 16): Buffer {
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(byteRate, 28);
  h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(bitsPerSample, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

function firstInline(json: GenResponse): { data: string; mime: string } | null {
  for (const part of json.candidates?.[0]?.content?.parts ?? []) {
    const d = part.inlineData?.data ?? part.inline_data?.data;
    const m = part.inlineData?.mimeType ?? part.inline_data?.mime_type;
    if (d) return { data: d, mime: m ?? "" };
  }
  return null;
}

async function callGemini(model: string, body: unknown): Promise<GenResponse> {
  const res = await fetch(`${BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": getGeminiKey(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status} (${model}): ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as GenResponse;
}

/** Synthesize narration. Returns a WAV buffer (Gemini TTS returns 24kHz PCM). */
export async function geminiTts(text: string, voice?: string): Promise<Buffer> {
  // TTS models misread a bare short phrase as an instruction (400 "tried to generate text").
  // The "Say:" style directive is NOT spoken — it just forces verbatim narration. (verified)
  const json = await callGemini(getGeminiTtsModel(), {
    contents: [{ parts: [{ text: `Say: ${text}` }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || getGeminiTtsVoice() } } },
    },
  });
  const out = firstInline(json);
  if (!out) throw new Error("Gemini TTS: 오디오 응답이 비어 있습니다 (GEMINI_TTS_MODEL 확인).");
  const rate = parseInt(out.mime.match(/rate=(\d+)/)?.[1] ?? "24000", 10);
  return pcmToWav(Buffer.from(out.data, "base64"), rate);
}

/** Generate instrumental BGM. Returns the audio buffer + file extension. */
export async function geminiMusic(prompt: string): Promise<{ buffer: Buffer; ext: string }> {
  const json = await callGemini(getGeminiMusicModel(), {
    contents: [{ parts: [{ text: `${prompt.trim()}. Instrumental only, no vocals.` }] }],
    generationConfig: { responseModalities: ["AUDIO", "TEXT"] },
  });
  const out = firstInline(json);
  if (!out) throw new Error("Gemini 음악: 오디오 응답이 비어 있습니다 (GEMINI_MUSIC_MODEL 확인).");
  const mime = out.mime.toLowerCase();
  const raw = Buffer.from(out.data, "base64");
  if (mime.includes("l16") || mime.includes("pcm")) {
    const rate = parseInt(out.mime.match(/rate=(\d+)/)?.[1] ?? "48000", 10);
    return { buffer: pcmToWav(raw, rate), ext: "wav" };
  }
  const ext = mime.includes("wav") ? "wav" : mime.includes("ogg") ? "ogg" : "mp3";
  return { buffer: raw, ext };
}
