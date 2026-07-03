// LLM script compose: trend topic + product + template catalog() → pages[] draft.
// OpenAI model via the existing OpenRouter client. Single zod boundary (zComposeOutput),
// unknown template ids COERCED to safe defaults (warnings returned, never hard-fail).
import "server-only";
import { z } from "zod";
import { OPENROUTER_BASE, authHeaders, toError } from "@/lib/openrouter/client";
import { parseJsonLoose } from "@/lib/openrouter/json";
import { getAdComposeModel } from "@/lib/env";
import { zComposeOutput, newPageId } from "@/lib/ad/schema";
import type { AdPage, AdProduct, AdProject } from "@/lib/ad/schema";
// meta.ts only (pure data) — importing the component registry here would evaluate
// remotion inside a server route and crash on React.createContext.
import {
  VISUAL_METAS,
  MOTION_METAS,
  TRANSITION_METAS,
  catalog,
  DEFAULT_VISUAL,
  DEFAULT_MOTION,
  DEFAULT_TRANSITION,
} from "@/remotion/ad/templates/meta";

const PAGE_MIN = 5;
const PAGE_MAX = 10;

function systemPrompt(): string {
  const cat = catalog().filter((m) => m.category !== "endcard");
  const lines = cat.map(
    (m) =>
      `- ${m.category}:"${m.id}" (${m.describe}${m.compatibleSourceTypes ? `; sources: ${m.compatibleSourceTypes.join("/")}` : ""})`
  );
  return [
    "You are a short-form ad scriptwriter for a 9:16 vertical product ad (TapNow-style: casual spoken Korean hooks, fast pacing).",
    "Given a topic and a product, design the ad as a sequence of PAGES. Each page = one template combo + caption + narration.",
    "",
    "TEMPLATE CATALOG (use ONLY these ids; respect source compatibility):",
    ...lines,
    "",
    "RULES:",
    `1) ${PAGE_MIN}-${PAGE_MAX} pages, total 30-45 seconds. Narration (vo) per page must take 2-4 seconds to speak (roughly 15-30 Korean syllables).`,
    "2) caption: on-screen Korean text, <=20 characters, punchy.",
    "3) vo: natural spoken Korean (반말 금지, ~요체), no exaggeration, no unverifiable performance/efficacy claims, no competitor disparagement.",
    '4) Structure: hook (problem) → product reveal/demo → value props → social proof or result → final push. Use "fullscreen-title" for the hook, "ui-demo-frame" with motion "shrink-into-ui" for the product reveal.',
    '5) sourceType: "video" pages MUST use video-compatible templates and include "clipQuery" (short English hint to find a stock clip). "image" pages include "imagePrompt" (vivid English image-generation prompt, vertical 9:16, no text in image).',
    '6) transitionTemplateId is the transition FROM this page TO the next. Vary them; use "cut" for fast beats; prefer "zoom-blur" or "dreamy-zoom" on the LAST page (into the endcard).',
    'Output ONLY this JSON object, no prose: {"pages":[{"sourceType":"image","visualTemplateId":"...","motionTemplateId":"...","transitionTemplateId":"...","caption":"...","vo":"...","imagePrompt":"...","clipQuery":"..."}]}',
  ].join("\n");
}

function userPrompt(topic: string, product: AdProduct): string {
  return JSON.stringify({ topic, product });
}

export interface ComposeResult {
  pages: AdPage[];
  warnings: string[];
  model: string;
}

async function callLlm(model: string, sys: string, user: string, useSchema: boolean): Promise<Response> {
  const responseFormat = useSchema
    ? {
        type: "json_schema",
        json_schema: { name: "ad_pages", strict: false, schema: z.toJSONSchema(zComposeOutput) },
      }
    : { type: "json_object" };
  return fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      temperature: 0.6,
      response_format: responseFormat,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    }),
  });
}

/** Validate + coerce one LLM page into a real AdPage (collecting Korean warnings). */
function coercePage(raw: z.infer<typeof zComposeOutput>["pages"][number], i: number, warnings: string[]): AdPage {
  const st = raw.sourceType;
  let visual = raw.visualTemplateId;
  const vt = VISUAL_METAS[visual];
  if (!vt || !(vt.compatibleSourceTypes ?? ["image", "video"]).includes(st)) {
    warnings.push(`페이지 ${i + 1}: 비주얼 "${visual}" → "${DEFAULT_VISUAL}"로 대체`);
    visual = DEFAULT_VISUAL;
  }
  let motion = raw.motionTemplateId;
  const mt = MOTION_METAS[motion];
  if (!mt || !(mt.compatibleSourceTypes ?? ["image", "video"]).includes(st)) {
    warnings.push(`페이지 ${i + 1}: 모션 "${motion}" → "${DEFAULT_MOTION}"로 대체`);
    motion = DEFAULT_MOTION;
  }
  let transition = raw.transitionTemplateId;
  if (!TRANSITION_METAS[transition]) {
    warnings.push(`페이지 ${i + 1}: 전환 "${transition}" → "${DEFAULT_TRANSITION}"로 대체`);
    transition = DEFAULT_TRANSITION;
  }
  if (raw.caption.length > 20) warnings.push(`페이지 ${i + 1}: 자막이 20자를 넘습니다 (${raw.caption.length}자)`);
  return {
    id: newPageId(),
    sourceType: st,
    source: { kind: "none" },
    visualTemplateId: visual,
    motionTemplateId: motion,
    transitionTemplateId: transition,
    caption: raw.caption,
    vo: raw.vo,
    imagePrompt: raw.imagePrompt,
    clipQuery: raw.clipQuery,
  };
}

export async function composeAdPages(project: AdProject): Promise<ComposeResult> {
  const model = getAdComposeModel();
  const topic = project.meta.topic || project.product.oneLiner;
  const sys = systemPrompt();
  const user = userPrompt(topic, project.product);

  let res = await callLlm(model, sys, user, true);
  if (!res.ok && res.status >= 400 && res.status < 500) {
    // some providers reject json_schema — fall back to json_object
    res = await callLlm(model, sys, user, false);
  }
  if (!res.ok) throw await toError(res);

  const attempt = async (response: Response): Promise<{ pages: AdPage[]; warnings: string[] }> => {
    const json = await response.json();
    const content: string = json.choices?.[0]?.message?.content ?? "";
    const parsed = zComposeOutput.parse(parseJsonLoose(content));
    const warnings: string[] = [];
    const pages = parsed.pages.slice(0, PAGE_MAX).map((p, i) => coercePage(p, i, warnings));
    return { pages, warnings };
  };

  let out: { pages: AdPage[]; warnings: string[] };
  try {
    out = await attempt(res);
  } catch {
    out = { pages: [], warnings: [] };
  }
  if (out.pages.length === 0) {
    // single retry without schema (different decode path)
    const retry = await callLlm(model, sys, user, false);
    if (!retry.ok) throw await toError(retry);
    out = await attempt(retry); // throws to the route on a second failure
  }
  if (out.pages.length < PAGE_MIN) {
    out.warnings.push(`페이지가 ${out.pages.length}개로 권장 범위(${PAGE_MIN}~${PAGE_MAX})보다 적습니다.`);
  }
  return { ...out, model };
}

// ── automation: fill text into a FIXED page structure (template reuse) ──────────
const zTextPage = z.object({
  caption: z.string(),
  vo: z.string(),
  imagePrompt: z.string().optional(),
  clipQuery: z.string().optional(),
});
const zTextOutput = z.object({ pages: z.array(zTextPage) });

/**
 * Keep the template's page structure (visual/motion/transition/styles) and only have the
 * LLM write each page's caption + narration (+ image prompt) for the given topic.
 */
export async function composeTextForPages(project: AdProject): Promise<{ pages: AdPage[]; warnings: string[] }> {
  const model = getAdComposeModel();
  const topic = project.meta.topic || project.product.oneLiner;
  const roles = project.pages
    .map((p, i) => `${i + 1}. ${VISUAL_METAS[p.visualTemplateId]?.name ?? p.visualTemplateId} [${p.sourceType}]`)
    .join("\n");
  const sys = [
    "You are a short-form ad scriptwriter for a 9:16 vertical product ad (casual spoken Korean, ~요체, fast pacing).",
    "The page LAYOUT/STRUCTURE is FIXED. Write the on-screen caption + narration for EACH page, matching its role.",
    `EVERYTHING must be about the TOPIC: "${topic}". Do NOT mention any unrelated subject, prior campaign, or stray keyword — write fresh copy for this topic only.`,
    '"brand" is just the product/brand name to mention naturally; "cta" is the call-to-action. There is no other product context — derive all benefits/claims from the TOPIC.',
    "Structure overall: hook → reveal/demo → value → social proof/result → final push.",
    "",
    "PAGES (fixed order; output EXACTLY one text entry per page, same count):",
    roles,
    "",
    "RULES:",
    "- caption: on-screen Korean text, <=20 characters, punchy, about the TOPIC.",
    "- vo: natural spoken Korean (~요체, 반말 금지), 2-4 seconds (~15-30 syllables), no exaggeration / unverifiable claims / competitor disparagement.",
    '- 2분할 비교(compare) pages: the caption labels two options (A/B) and the imagePrompt should describe a SINGLE clear subject for the slot (NOT a "split screen").',
    '- image pages: add "imagePrompt" (vivid English image-gen prompt, vertical 9:16, no text in image). video pages: add "clipQuery" (short English stock-clip hint).',
    `- Output ONLY this JSON: {"pages":[${"{\"caption\":\"...\",\"vo\":\"...\",\"imagePrompt\":\"...\"}"}]} with exactly ${project.pages.length} entries.`,
  ].join("\n");
  // only brand identity — NOT the template's stale oneLiner/valueProps (which describe other topics)
  const user = JSON.stringify({ topic, brand: project.product.name, cta: project.product.cta });

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model,
      max_tokens: 6000,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw await toError(res);
  const json = await res.json();
  const content: string = json.choices?.[0]?.message?.content ?? "";
  const parsed = zTextOutput.parse(parseJsonLoose(content));

  const warnings: string[] = [];
  if (parsed.pages.length < project.pages.length) {
    warnings.push(`대본 텍스트가 ${parsed.pages.length}개로 페이지 수(${project.pages.length})보다 적습니다 — 나머지 페이지의 문구를 비웠습니다.`);
  }
  const pages = project.pages.map((p, i) => {
    const t = parsed.pages[i];
    if (!t) {
      // LLM returned fewer entries — BLANK the topic-specific copy instead of keeping the
      // template's previous-campaign captions/VO (which would leak into the new video).
      return { ...p, caption: "", vo: "", voAudio: undefined, imagePrompt: undefined, clipQuery: undefined };
    }
    if (t.caption.length > 20) warnings.push(`페이지 ${i + 1}: 자막이 20자를 넘습니다 (${t.caption.length}자)`);
    return {
      ...p,
      caption: t.caption,
      vo: t.vo,
      // the vo text changed → the template's old narration audio no longer matches; drop
      // it so a TTS-less run can't render old-topic voiceover (durations fall back).
      voAudio: t.vo === p.vo ? p.voAudio : undefined,
      imagePrompt: p.sourceType === "image" ? t.imagePrompt ?? p.imagePrompt : p.imagePrompt,
      clipQuery: p.sourceType === "video" ? t.clipQuery ?? p.clipQuery : p.clipQuery,
    };
  });
  return { pages, warnings };
}
