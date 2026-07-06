// VO (narration) TTS for ad pages. Provider auto-selected (ElevenLabs / Gemini) from
// whichever key is configured. Hash-keyed audio (skip if unchanged, stale cleanup),
// duration measured server-side with @remotion/media-parser (same vendor as the renderer).
import "server-only";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { parseMedia } from "@remotion/media-parser";
import { nodeReader } from "@remotion/media-parser/node";
import {
  getElevenLabsKey,
  getElevenLabsVoiceId,
  getGeminiTtsVoice,
  getAdTtsProvider,
  hasElevenLabsKey,
  hasGeminiKey,
} from "@/lib/env";
import { geminiTts } from "@/lib/gemini/audio";
import { estimateWords, type WordTiming } from "@/lib/ad/captions";
import { readAdProject, mutateAdProject, projectDirAbs } from "@/lib/ad/store";
import type { AdProject } from "@/lib/ad/schema";

// Flash = cheapest/fastest multilingual (incl. Korean). Swap for quality if needed:
// const MODEL_ID = "eleven_multilingual_v2";
const MODEL_ID = "eleven_flash_v2_5";
const OUTPUT_FORMAT = "mp3_44100_128";

const voHash = (key: string, text: string) =>
  createHash("sha256").update(`${key}\n${text}`).digest("hex").slice(0, 8);

/** Pick the TTS provider: explicit env override, else whichever key exists (ElevenLabs first). */
function resolveTtsProvider(): { provider: "elevenlabs" | "gemini"; voice: string; ext: "mp3" | "wav" } {
  const explicit = getAdTtsProvider();
  const useGemini = explicit === "gemini" || (explicit !== "elevenlabs" && !hasElevenLabsKey() && hasGeminiKey());
  return useGemini
    ? { provider: "gemini", voice: getGeminiTtsVoice(), ext: "wav" }
    : { provider: "elevenlabs", voice: getElevenLabsVoiceId(), ext: "mp3" };
}

interface ElevenAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

/** Aggregate ElevenLabs character alignment into word timings (split on whitespace). */
function alignmentToWords(a: ElevenAlignment | undefined): WordTiming[] | undefined {
  if (!a?.characters?.length) return undefined;
  const out: WordTiming[] = [];
  let word = "";
  let start = 0;
  let end = 0;
  for (let i = 0; i < a.characters.length; i++) {
    const ch = a.characters[i];
    if (/\s/.test(ch)) {
      if (word) out.push({ w: word, s: start, e: end });
      word = "";
      continue;
    }
    if (!word) start = a.character_start_times_seconds[i] ?? end;
    word += ch;
    end = a.character_end_times_seconds[i] ?? end;
  }
  if (word) out.push({ w: word, s: start, e: end });
  return out.length ? out : undefined;
}

/** ElevenLabs TTS via /with-timestamps — returns audio + word-level timing for karaoke. */
async function elevenLabsTts(text: string, voiceId: string): Promise<{ buf: Buffer; words?: WordTiming[] }> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=${OUTPUT_FORMAT}`,
    {
      method: "POST",
      headers: { "xi-api-key": getElevenLabsKey(), "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: MODEL_ID }),
    }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ${res.status}: ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as { audio_base64?: string; alignment?: ElevenAlignment; normalized_alignment?: ElevenAlignment };
  if (!json.audio_base64) throw new Error("ElevenLabs: 오디오 응답이 비어 있습니다.");
  return { buf: Buffer.from(json.audio_base64, "base64"), words: alignmentToWords(json.alignment ?? json.normalized_alignment) };
}

export async function mp3DurationSec(absPath: string): Promise<number> {
  const { slowDurationInSeconds } = await parseMedia({
    src: absPath,
    reader: nodeReader,
    fields: { slowDurationInSeconds: true },
    acknowledgeRemotionLicense: true,
  });
  return Math.round(slowDurationInSeconds * 1000) / 1000;
}

/**
 * Generate (or reuse) the VO for one page. Idempotent: unchanged voiceId+text → no-op.
 * Stale `page-<id>-*.mp3` siblings are removed after a successful regen.
 */
export async function ttsPage(projectId: string, pageId: string): Promise<AdProject> {
  const snapshot = await readAdProject(projectId);
  const page = snapshot.pages.find((p) => p.id === pageId);
  if (!page) throw new Error("페이지를 찾을 수 없습니다.");
  const text = page.vo.trim();
  if (!text) throw new Error("VO 텍스트가 비어 있습니다.");

  const { provider, voice, ext } = resolveTtsProvider();
  const hash = voHash(`${provider}:${voice}`, text);
  const audioDirAbs = path.join(projectDirAbs(projectId), "audio");
  const fileName = `page-${page.id}-${hash}.${ext}`;
  const absPath = path.join(audioDirAbs, fileName);
  const relPath = path.posix.join("outputs", "results", projectId, "audio", fileName);

  if (page.voAudio?.hash === hash) {
    try {
      await fs.access(absPath);
      return snapshot; // unchanged + file present → no-op
    } catch {
      /* file missing → regenerate below */
    }
  }

  let buf: Buffer;
  let words: WordTiming[] | undefined;
  if (provider === "gemini") {
    buf = await geminiTts(text, voice);
  } else {
    ({ buf, words } = await elevenLabsTts(text, voice));
  }
  await fs.mkdir(audioDirAbs, { recursive: true });
  await fs.writeFile(absPath, buf);
  const durationSec = await mp3DurationSec(absPath);
  // no provider alignment (Gemini / older responses) → estimate proportionally
  if (!words?.length) words = estimateWords(text, durationSec);

  // DELTA write behind the project lock: the TTS call takes seconds — patch only this
  // page's voAudio so concurrent saves/ops aren't clobbered (and can't clobber us).
  const saved = await mutateAdProject(projectId, (fresh) => {
    const target = fresh.pages.find((p) => p.id === pageId);
    if (target) target.voAudio = { path: relPath, durationSec, hash, words: words?.length ? words : undefined };
  });

  // drop stale takes AFTER the project points at the new file (never delete what the
  // persisted index.json still references)
  try {
    for (const f of await fs.readdir(audioDirAbs)) {
      if (f.startsWith(`page-${page.id}-`) && f !== fileName) await fs.unlink(path.join(audioDirAbs, f));
    }
  } catch {
    /* best-effort cleanup */
  }
  return saved;
}
