// Render entry point: validate a composition, render one or more languages, record outputs.
import "server-only";
import { readComposition, addRender } from "@/lib/post/composition";
import { composeShort } from "./compose";
import type { Language } from "@/lib/types";

export interface RenderProgress {
  (ev: { phase: string; detail?: string; language?: Language }): void;
}

/** Render a single language; returns the outputs/-relative mp4 path. */
export async function renderComposition(
  compId: string,
  language: Language,
  onProgress?: RenderProgress
): Promise<string> {
  const comp = await readComposition(compId);

  const main = comp.stages.find((s) => s.id === "main");
  if (main?.aRef?.prompt && main?.bRef?.prompt && main.aRef.prompt !== main.bRef.prompt) {
    throw new Error("본론 A/B는 같은 프롬프트로 만든 소스여야 합니다.");
  }
  if (main && (!main.aRef || !main.bRef)) {
    throw new Error("본론 비교 소스(A/B)를 모두 설정하세요.");
  }

  const rel = await composeShort(comp, {
    language,
    preset: comp.renderOpts.preset,
    crf: comp.renderOpts.crf,
    onProgress: (phase, detail) => onProgress?.({ phase, detail, language }),
  });
  await addRender(compId, language, rel);
  return rel;
}

/** Render every requested language sequentially (ffmpeg is CPU-heavy). */
export async function renderLanguages(
  compId: string,
  languages: Language[],
  onProgress?: RenderProgress
): Promise<Partial<Record<Language, string>>> {
  const out: Partial<Record<Language, string>> = {};
  for (const lang of languages) {
    onProgress?.({ phase: "start", detail: `${lang} 렌더 시작`, language: lang });
    out[lang] = await renderComposition(compId, lang, onProgress);
  }
  return out;
}
