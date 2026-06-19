// ElevenLabs VO TTS for ad pages. Hash-keyed mp3s (skip if unchanged, stale cleanup),
// duration measured server-side with @remotion/media-parser (same vendor as the renderer).
import "server-only";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { parseMedia } from "@remotion/media-parser";
import { nodeReader } from "@remotion/media-parser/node";
import { getElevenLabsKey, getElevenLabsVoiceId } from "@/lib/env";
import { readAdProject, writeAdProject, projectDirAbs } from "@/lib/ad/store";
import type { AdProject } from "@/lib/ad/schema";

// Flash = cheapest/fastest multilingual (incl. Korean). Swap for quality if needed:
// const MODEL_ID = "eleven_multilingual_v2";
const MODEL_ID = "eleven_flash_v2_5";
const OUTPUT_FORMAT = "mp3_44100_128";

const voHash = (voiceId: string, text: string) =>
  createHash("sha256").update(`${voiceId}\n${text}`).digest("hex").slice(0, 8);

async function elevenLabsTts(text: string, voiceId: string): Promise<Buffer> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${OUTPUT_FORMAT}`,
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
  return Buffer.from(await res.arrayBuffer());
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

  const voiceId = getElevenLabsVoiceId();
  const hash = voHash(voiceId, text);
  const audioDirAbs = path.join(projectDirAbs(projectId), "audio");
  const fileName = `page-${page.id}-${hash}.mp3`;
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

  const buf = await elevenLabsTts(text, voiceId);
  await fs.mkdir(audioDirAbs, { recursive: true });
  await fs.writeFile(absPath, buf);
  const durationSec = await mp3DurationSec(absPath);

  // drop stale takes for this page
  try {
    for (const f of await fs.readdir(audioDirAbs)) {
      if (f.startsWith(`page-${page.id}-`) && f !== fileName) await fs.unlink(path.join(audioDirAbs, f));
    }
  } catch {
    /* best-effort cleanup */
  }

  // DELTA write: the TTS call takes seconds — re-read and patch only this page's
  // voAudio so concurrent saves (other captions, product edits …) aren't clobbered.
  const fresh = await readAdProject(projectId);
  const target = fresh.pages.find((p) => p.id === pageId);
  if (!target) return fresh; // page deleted mid-call — keep the deletion, drop the audio
  target.voAudio = { path: relPath, durationSec, hash };
  return writeAdProject(fresh);
}
