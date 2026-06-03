// Server-only persistence for the INDEPENDENT Composition (3-stage short) artifact.
//   outputs/results/<sourceType>/<timestamp>/index.json
import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { safeOutputsPath, RESULTS_ROOT, timestamp } from "@/lib/storage";
import {
  DEFAULT_RENDER_OPTS,
  STAGE_DEFAULT_DURATION,
} from "@/lib/composition-types";
import type { Composition, Stage, SourceType } from "@/lib/composition-types";
import type { Language } from "@/lib/types";
import { TOPICS, DEFAULT_TOPIC_ID, DEFAULT_CARD_TEMPLATE, CTA_PRESETS } from "@/lib/render/strings";

/** Absolute folder for a composition. compId = "<sourceType>/<timestamp>". */
export function compDirAbs(compId: string): string {
  return safeOutputsPath(path.posix.join("results", compId));
}
/** outputs/-relative composition folder. */
export function compRelDir(compId: string): string {
  return path.posix.join("outputs", "results", compId);
}
const compFile = (compId: string) => path.join(compDirAbs(compId), "index.json");

function defaultStages(language: Language, topicId: string): Stage[] {
  const topic = TOPICS[topicId] ?? TOPICS[DEFAULT_TOPIC_ID];
  return [
    {
      id: "start",
      order: 0,
      enabled: true,
      durationSec: STAGE_DEFAULT_DURATION.start,
      textMode: "overlay",
      textPos: "center",
      image: { source: "template", templateId: DEFAULT_CARD_TEMPLATE },
      headline: { ...topic.copy.headline },
      sub: { ...topic.copy.sub },
    },
    {
      id: "main",
      order: 1,
      enabled: true,
      durationSec: STAGE_DEFAULT_DURATION.main,
      textMode: "overlay",
      layout: "split",
      motionStyle: "kenburns-vs",
      panelStyle: "rounded-shadow",
      videoFit: "loop",
      bodyDurationSec: STAGE_DEFAULT_DURATION.main,
      showLabels: true,
      labelPos: "tl",
    },
    {
      id: "end",
      order: 2,
      enabled: true,
      durationSec: STAGE_DEFAULT_DURATION.end,
      textMode: "overlay",
      textPos: "center",
      image: { source: "template", templateId: "light" },
      elements: [
        { id: "cta", kind: "text", enabled: true, pos: "center", text: { ...CTA_PRESETS[0].text }, size: 64 },
        { id: "logo", kind: "logo", enabled: false, pos: "center", size: 720 },
      ],
    },
  ];
}

export async function createComposition(opts: {
  sourceType: SourceType;
  primaryLanguage: Language;
  topicId?: string;
}): Promise<Composition> {
  const topicId = opts.topicId ?? DEFAULT_TOPIC_ID;
  const now = new Date().toISOString();
  const ts = timestamp();
  const comp: Composition = {
    compId: path.posix.join(opts.sourceType, ts),
    sourceType: opts.sourceType,
    primaryLanguage: opts.primaryLanguage,
    renderLanguages: [opts.primaryLanguage],
    topicId,
    createdAt: now,
    updatedAt: now,
    stages: defaultStages(opts.primaryLanguage, topicId),
    renderOpts: { ...DEFAULT_RENDER_OPTS },
    renders: {},
  };
  await writeComposition(comp);
  return comp;
}

export async function writeComposition(comp: Composition): Promise<void> {
  const dir = compDirAbs(comp.compId);
  await fs.mkdir(dir, { recursive: true });
  comp.updatedAt = new Date().toISOString();
  await fs.writeFile(compFile(comp.compId), JSON.stringify(comp, null, 2), "utf8");
}

export async function readComposition(compId: string): Promise<Composition> {
  return JSON.parse(await fs.readFile(compFile(compId), "utf8")) as Composition;
}

export async function listCompositions(): Promise<Composition[]> {
  const out: Composition[] = [];
  let types: string[] = [];
  try {
    types = (await fs.readdir(RESULTS_ROOT, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
  for (const type of types) {
    let stamps: string[] = [];
    try {
      stamps = (await fs.readdir(path.join(RESULTS_ROOT, type), { withFileTypes: true }))
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch {
      continue;
    }
    for (const ts of stamps) {
      try {
        out.push(await readComposition(path.posix.join(type, ts)));
      } catch {
        /* skip unreadable */
      }
    }
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Append a render to the composition's history (kept across re-renders) + update latest. */
export async function addRender(compId: string, language: Language, relPath: string): Promise<Composition> {
  const comp = await readComposition(compId);
  const createdAt = new Date().toISOString();
  comp.renderHistory = [{ language, path: relPath, createdAt }, ...(comp.renderHistory ?? [])];
  comp.renders = { ...comp.renders, [language]: relPath };
  await writeComposition(comp);
  return comp;
}
