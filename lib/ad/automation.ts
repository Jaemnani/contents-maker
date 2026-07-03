// Ad automation: reuse a recent project's STRUCTURE as a template, auto-pick a topic from
// trends, then run the full pipeline (text → images → TTS → BGM → render). Configs are
// stored on disk; a runner script (scripts/ad-auto.mjs) fires runs N times/day.
import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { z } from "zod";
import { OUTPUTS_ROOT, timestamp } from "@/lib/storage";
import { readAdProject, writeAdProject, projectDirAbs } from "@/lib/ad/store";
import { newPageId, slotSource, SLOT_SOURCE_FIELD, SLOT_PROMPT_FIELD, type SlotKey } from "@/lib/ad/schema";
import type { AdProject, PageSource } from "@/lib/ad/schema";
import { composeTextForPages } from "@/lib/ad/compose";
import { generateImageSources } from "@/lib/post/source-gen";
import { ttsPage } from "@/lib/ad/tts";
import { generateAdBgm } from "@/lib/ad/bgm";
import { renderAd } from "@/lib/ad/render";
import { getTrends } from "@/lib/trends";
import { curateTopics } from "@/lib/topic/curate";
import { pickText } from "@/lib/render/strings";
import { CHEAPEST_PRESETS, modelsByModality } from "@/lib/models";

// ── config ───────────────────────────────────────────────────────────────────
export const zAutoSteps = z.object({
  text: z.boolean(),
  image: z.boolean(),
  tts: z.boolean(),
  bgm: z.boolean(),
  render: z.boolean(),
});
export const zAutoConfig = z.object({
  id: z.string(),
  name: z.string(),
  templateProjectId: z.string(), // "ad/<ts>"
  enabled: z.boolean(),
  dailyCount: z.number().int().min(1).max(48),
  topicProvider: z.string(), // "" = keyword only; else "youtube" / "news"
  topicKeyword: z.string(),
  imageModel: z.string(), // default uid; "" = cheapest
  // which page slots to REGENERATE (cost). Keys are "<templatePageId>:<slot>" (stable
  // across template reordering; legacy "<pageIndex>:<slot>" still resolves).
  // Everything else reuses the template's existing image/video.
  regen: z.array(z.string()).default([]),
  slotModels: z.record(z.string(), z.string()).default({}), // per-slot model override (key → uid)
  slotLinks: z.record(z.string(), z.string()).default({}), // key copies the image of another key's slot
  steps: zAutoSteps,
  createdAt: z.string(),
  updatedAt: z.string(),
  lastRunAt: z.string().optional(),
});
export type AutoConfig = z.infer<typeof zAutoConfig>;

const DIR = path.join(OUTPUTS_ROOT, "automation");
const FILE = path.join(DIR, "configs.json");

// All config mutations are read-modify-write on one JSON file — serialize them through a
// module-level chain and write atomically (tmp+rename) so a torn/concurrent write can
// never be read back as "empty" and wipe every other config.
let configChain: Promise<unknown> = Promise.resolve();
function withConfigLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = configChain.then(fn, fn);
  configChain = next.catch(() => {});
  return next;
}

export async function listConfigs(): Promise<AutoConfig[]> {
  let raw: string;
  try {
    raw = await fs.readFile(FILE, "utf8");
  } catch {
    return []; // ENOENT (no configs yet) — the only case that legitimately means "none"
  }
  // a corrupt/invalid file must THROW, not be treated as empty (a later save would then
  // persist only the new config and silently delete all others)
  return z.array(zAutoConfig).parse(JSON.parse(raw));
}
async function writeConfigs(arr: AutoConfig[]): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(arr, null, 2), "utf8");
  await fs.rename(tmp, FILE);
}

/** Create or update a config (partial input; id optional). */
export async function saveConfig(input: Partial<AutoConfig>): Promise<AutoConfig> {
  return withConfigLock(async () => {
    const arr = await listConfigs();
    const now = new Date().toISOString();
    const id = input.id || `auto-${randomUUID().slice(0, 8)}`;
    const existing = arr.find((c) => c.id === id);
    const cfg = zAutoConfig.parse({
      name: input.name ?? "자동화",
      templateProjectId: input.templateProjectId ?? "",
      enabled: input.enabled ?? true,
      dailyCount: input.dailyCount ?? 1,
      topicProvider: input.topicProvider ?? "",
      topicKeyword: input.topicKeyword ?? "",
      imageModel: input.imageModel ?? "",
      regen: input.regen ?? [],
      slotModels: input.slotModels ?? {},
      slotLinks: input.slotLinks ?? {},
      steps: input.steps ?? { text: true, image: true, tts: true, bgm: true, render: true },
      ...input,
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      // server-owned: only markRun may advance this. A UI toggle POSTs the whole config it
      // fetched earlier — accepting its stale lastRunAt would make the config due again.
      lastRunAt: existing?.lastRunAt,
    });
    await writeConfigs(existing ? arr.map((c) => (c.id === id ? cfg : c)) : [...arr, cfg]);
    return cfg;
  });
}
export async function deleteConfig(id: string): Promise<void> {
  return withConfigLock(async () => {
    await writeConfigs((await listConfigs()).filter((c) => c.id !== id));
  });
}
async function markRun(id: string): Promise<void> {
  return withConfigLock(async () => {
    const arr = await listConfigs();
    await writeConfigs(arr.map((c) => (c.id === id ? { ...c, lastRunAt: new Date().toISOString() } : c)));
  });
}

// ── pipeline ───────────────────────────────────────────────────────────────────
function cheapestImageModel(): string {
  const preset = CHEAPEST_PRESETS.image?.[0];
  if (preset) return preset;
  return modelsByModality("image")[0]?.uid ?? "";
}
/** A working image model different from `exclude` (prefers the next cheapest preset). */
function distinctImageModel(exclude: string): string {
  for (const uid of CHEAPEST_PRESETS.image ?? []) if (uid && uid !== exclude) return uid;
  for (const m of modelsByModality("image")) if (m.uid !== exclude) return m.uid;
  return exclude; // only one image model available
}

/** Trend → curated topic. Falls back to the keyword (or a generic seed) when trends fail. */
async function pickTopic(cfg: AutoConfig): Promise<{ topic: string; seedPrompt?: string }> {
  let terms: string[] = [];
  if (cfg.topicProvider) {
    try {
      const items = await getTrends(cfg.topicProvider, { lang: "ko", query: cfg.topicKeyword || undefined, limit: 20 });
      terms = items.map((i) => i.term).filter(Boolean).slice(0, 12);
    } catch {
      /* trends down → fall through to keyword */
    }
  }
  if (!terms.length && cfg.topicKeyword.trim()) terms = [cfg.topicKeyword.trim()];
  if (!terms.length) terms = ["AI 영상 에디터"];
  const cands = await curateTopics(terms, "ko", 6);
  if (!cands.length) return { topic: cfg.topicKeyword.trim() || terms[0] };
  const c = cands[Math.floor(Math.random() * cands.length)]; // vary across daily runs
  return { topic: pickText(c.headline, "ko") || c.term, seedPrompt: c.comparePrompt };
}

/**
 * Clone a template into a fresh project, REUSING all its content (sources, captions, VO,
 * BGM, endcard) by default — only the new topic is applied. Enabled steps then overwrite:
 * text (compose), the selected image slots (regen), TTS, BGM, render.
 * Audio files living under the TEMPLATE's folder (page VO, generated/uploaded BGM) are
 * COPIED into the clone — otherwise a later regen on the template would delete files the
 * clone still references (stale-take cleanup), breaking the clone's renders.
 */
async function cloneTemplate(template: AdProject, topic: string, seedPrompt?: string): Promise<AdProject> {
  const now = new Date().toISOString();
  const projectId = path.posix.join("ad", `${timestamp()}-${randomUUID().slice(0, 4)}`);
  const templatePrefix = `outputs/results/${template.projectId}/`;
  const cloneAudioAbs = path.join(projectDirAbs(projectId), "audio");

  /** Copy an outputs/-relative file from the template dir into the clone; returns the new rel path (or the original on failure). */
  async function adoptFile(relPath: string): Promise<string> {
    if (!relPath.startsWith(templatePrefix)) return relPath; // not template-owned — leave as is
    try {
      const srcAbs = path.join(process.cwd(), relPath);
      const fileName = path.basename(relPath);
      await fs.mkdir(cloneAudioAbs, { recursive: true });
      await fs.copyFile(srcAbs, path.join(cloneAudioAbs, fileName));
      return path.posix.join("outputs", "results", projectId, "audio", fileName);
    } catch {
      return relPath; // source missing — keep the original reference
    }
  }

  const pages = [];
  for (const p of template.pages) {
    const page = { ...p, id: newPageId() }; // structure+media reused; fresh ids
    if (page.voAudio) page.voAudio = { ...page.voAudio, path: await adoptFile(page.voAudio.path) };
    pages.push(page);
  }
  let audio = { ...template.audio };
  if (audio.bgm.kind === "upload") audio = { ...audio, bgm: { kind: "upload", path: await adoptFile(audio.bgm.path) } };

  return {
    ...template,
    projectId,
    createdAt: now,
    updatedAt: now,
    meta: { ...template.meta, topic, seedPrompt: seedPrompt || undefined },
    // keep BRAND (name/color/logo/cta) but drop the template's topic-specific copy so it
    // can't pollute the new topic's script (e.g. stale value-props leaking in).
    product: { ...template.product, oneLiner: "", valueProps: [] },
    pages,
    audio,
    latestRender: null,
    renderHistory: [],
  };
}

/**
 * Resolve a slot-plan key to a page index. New keys are "<templatePageId>:<slot>" (stable
 * across template reordering); legacy keys are "<pageIndex>:<slot>". The clone preserves
 * template page ORDER, so a template-id lookup maps 1:1 onto the clone's index.
 */
function resolveSlotKey(key: string, templatePages: AdProject["pages"]): { i: number; slot: SlotKey } | null {
  const sep = key.lastIndexOf(":");
  if (sep < 0) return null;
  const ref = key.slice(0, sep);
  const slot = key.slice(sep + 1);
  if (!["A", "B", "C", "D"].includes(slot)) return null;
  const byId = templatePages.findIndex((p) => p.id === ref);
  if (byId >= 0) return { i: byId, slot: slot as SlotKey };
  const i = /^\d+$/.test(ref) ? parseInt(ref, 10) : NaN; // legacy index key
  if (Number.isNaN(i)) return null;
  return { i, slot: slot as SlotKey };
}

export interface AutoRunResult {
  projectId: string;
  topic: string;
  steps: string[];
  warnings: string[];
  renderPath: string | null;
}

/** Run one full automated generation from a config. Long-running (compose+gen+render). */
export async function runAutomation(cfg: AutoConfig, assetBase: string): Promise<AutoRunResult> {
  // stamp the ATTEMPT up front: a failing step must not leave the config "due" on every
  // poll tick (endless retry = endless LLM cost), and a long run must not double-fire.
  await markRun(cfg.id);
  const template = await readAdProject(cfg.templateProjectId);
  if (!template.pages.length) throw new Error("템플릿에 페이지가 없습니다.");
  const { topic, seedPrompt } = await pickTopic(cfg);

  let project = await cloneTemplate(template, topic, seedPrompt);
  await writeAdProject(project);
  const projectId = project.projectId;
  const warnings: string[] = [];
  const done: string[] = [];

  if (cfg.steps.text) {
    const { pages, warnings: w } = await composeTextForPages(project);
    project.pages = pages;
    project = await writeAdProject(project);
    warnings.push(...w);
    done.push("대본");
    if (!cfg.steps.tts) warnings.push("대본이 바뀌어 기존 내레이션 음성은 제거됨 — TTS 단계가 꺼져 있어 무음/기본 길이로 렌더됩니다.");
  }

  // images: GENERATE the selected slots, LINK others to a slot's image; everything else
  // reuses the template's. Generate runs first so links can point at a fresh image.
  const genKeys = cfg.regen.filter((k) => !cfg.slotLinks[k]);
  const linkKeys = Object.keys(cfg.slotLinks);
  if (cfg.steps.image && (genKeys.length || linkKeys.length)) {
    const setSlot = (p: AdProject["pages"][number], slot: SlotKey, source: PageSource, label?: string) => {
      (p as Record<string, unknown>)[SLOT_SOURCE_FIELD[slot]] = source;
      if (p.visualTemplateId === "compare-2up" && label) {
        if (slot === "A") p.compareLabelA = label;
        else if (slot === "B") p.compareLabelB = label;
      }
    };
    const generated: Record<string, PageSource> = {};

    // resolve slot keys against the TEMPLATE's pages (id-based; clone preserves order)
    const resolved = new Map<string, { i: number; slot: SlotKey }>();
    for (const key of [...genKeys, ...linkKeys, ...Object.values(cfg.slotLinks)]) {
      const r = resolveSlotKey(key, template.pages);
      if (r) resolved.set(key, r);
      else if (genKeys.includes(key)) warnings.push(`슬롯 "${key}": 템플릿에서 해당 페이지를 찾지 못해 건너뜀(템플릿이 수정되었나요?)`);
    }

    // resolve a model per generate-slot, then make compare-2up A/B differ when they'd be the
    // same default (the whole point of A-vs-B is two DIFFERENT models).
    const keyModel: Record<string, string> = {};
    for (const key of genKeys) keyModel[key] = cfg.slotModels[key] || cfg.imageModel || cheapestImageModel();
    for (let i = 0; i < project.pages.length; i++) {
      if (project.pages[i].visualTemplateId !== "compare-2up") continue;
      const aKey = genKeys.find((k) => resolved.get(k)?.i === i && resolved.get(k)?.slot === "A");
      const bKey = genKeys.find((k) => resolved.get(k)?.i === i && resolved.get(k)?.slot === "B");
      if (!aKey || !bKey || keyModel[aKey] !== keyModel[bKey]) continue;
      const bDefault = !cfg.slotModels[bKey];
      const aDefault = !cfg.slotModels[aKey];
      if (bDefault) keyModel[bKey] = distinctImageModel(keyModel[aKey]);
      else if (aDefault) keyModel[aKey] = distinctImageModel(keyModel[bKey]);
      if (bDefault || aDefault) warnings.push(`p${i + 1}: 비교를 위해 A/B를 서로 다른 모델로 자동 설정`);
    }

    for (const key of genKeys) {
      const parsed = resolved.get(key);
      if (!parsed) continue;
      const { i, slot } = parsed;
      const p = project.pages[i];
      if (!p) continue;
      if (p.sourceType !== "image") {
        warnings.push(`p${i + 1} ${slot}: 영상 페이지는 자동 생성 미지원 — 기존 소스 유지`);
        continue;
      }
      const prompt = (p[SLOT_PROMPT_FIELD[slot]] as string | undefined)?.trim() || p.imagePrompt?.trim();
      if (!prompt) {
        warnings.push(`p${i + 1} ${slot}: 이미지 프롬프트가 없어 건너뜀(대본 단계를 켜면 생성됩니다)`);
        continue;
      }
      const model = keyModel[key];
      try {
        const { refs, errors } = await generateImageSources({ language: "ko", prompt, models: [model], aspect: "9:16" });
        const ref = refs[0];
        if (!ref) {
          warnings.push(`p${i + 1} ${slot}: 이미지 생성 실패 — ${errors[0]?.error ?? "빈 결과"}`);
          continue;
        }
        const source: PageSource = { kind: "asset", ref };
        generated[key] = source;
        setSlot(p, slot, source, ref.label);
      } catch (e) {
        warnings.push(`p${i + 1} ${slot}: 이미지 생성 오류 — ${(e as Error).message}`);
      }
    }

    for (const target of linkKeys) {
      const srcKey = cfg.slotLinks[target];
      const t = resolved.get(target);
      const s = resolved.get(srcKey);
      if (!t || !s) continue;
      const tPage = project.pages[t.i];
      const sPage = project.pages[s.i];
      if (!tPage || !sPage) continue;
      const source = generated[srcKey] ?? slotSource(sPage, s.slot);
      if (source.kind === "none") {
        warnings.push(`p${t.i + 1} ${t.slot}: 동일 사용할 원본(p${s.i + 1} ${s.slot}) 이미지가 없습니다`);
        continue;
      }
      setSlot(tPage, t.slot, source, source.kind === "asset" ? source.ref.label : undefined);
    }

    project = await writeAdProject(project);
    done.push(`이미지(생성 ${genKeys.length}·동일 ${linkKeys.length})`);
  }

  if (cfg.steps.tts) {
    for (const p of project.pages) {
      if (!p.vo.trim()) continue;
      try {
        project = await ttsPage(projectId, p.id);
      } catch (e) {
        warnings.push(`TTS 오류: ${(e as Error).message}`);
      }
    }
    done.push("TTS");
  }

  if (cfg.steps.bgm) {
    try {
      project = await generateAdBgm(projectId, `Upbeat modern background music for a short product ad about ${topic}`);
      done.push("BGM");
    } catch (e) {
      warnings.push(`BGM 오류: ${(e as Error).message}`);
    }
  }

  let renderPath: string | null = null;
  if (cfg.steps.render) {
    try {
      renderPath = await renderAd(projectId, assetBase);
      done.push("렌더");
    } catch (e) {
      warnings.push(`렌더 오류: ${(e as Error).message}`);
    }
  }

  return { projectId, topic, steps: done, warnings, renderPath };
}

/** Configs that are due to run now (based on dailyCount + lastRunAt). Used by the runner. */
export function dueConfigs(configs: AutoConfig[], now = Date.now()): AutoConfig[] {
  return configs.filter((c) => {
    if (!c.enabled) return false;
    const interval = 86_400_000 / c.dailyCount; // ms between runs
    if (!c.lastRunAt) return true;
    return now - new Date(c.lastRunAt).getTime() >= interval;
  });
}
