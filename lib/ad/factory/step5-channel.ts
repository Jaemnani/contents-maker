// STEP 5 · 채널별 변형 — 포맷이 채널을 결정한다 (SKILL STEP5 표).
// 카피 형식은 shortform_distribution.md·voice.md를 프롬프트로 주입해 생성하고,
// 쇼츠 "영상 실물"은 기존 Remotion 파이프라인이 렌더한다 — 여기서는 페이지 명세(props)만 만든다.
import "server-only";
import { z } from "zod";
import {
  zFactoryChannel,
  newAdPage,
  type AdPage,
  type ChannelOutput,
  type ContentPiece,
  type FactorySource,
  type FactoryTopic,
  type FormatKind,
} from "@/lib/ad/schema";
import { factoryLlm } from "@/lib/ad/factory/llm";
import { voiceRules } from "@/lib/ad/factory/rules/voice";
import { distributionRules } from "@/lib/ad/factory/rules/distribution";
import { AIB_CTA, CHANNELS_FOR_FORMAT, CHANNEL_SPECS, CHANNEL_UTM, buildAibLink, utmContentFor } from "@/lib/ad/factory/presets";

// 항목별 관용 파싱: 배열 전체를 하드 파싱하면 불량 항목 1개가 배치 전체를 무너뜨린다.
// format은 그룹 호출이 코드로 강제하므로 스키마에서 요구하지 않는다.
const zChannelItem = z.object({
  channel: zFactoryChannel,
  title: z.string().optional(),
  body: z.string(),
  tags: z.array(z.string()).default([]),
  parts: z.array(z.string()).optional(),
});
const zChannelOut = z.object({ outputs: z.array(z.unknown()) });

/** 확정된 포맷 → 필요한 (포맷 × 채널) 출력 목록. Reddit은 오픈웨이트 유형이 있을 때만. */
export function requiredOutputs(formats: FormatKind[], pieces: ContentPiece[]): { format: FormatKind; channel: (typeof zFactoryChannel)["options"][number] }[] {
  const hasOpenWeight = pieces.some((p) => p.type === "open_weight");
  const out: { format: FormatKind; channel: (typeof zFactoryChannel)["options"][number] }[] = [];
  for (const f of formats) {
    for (const ch of CHANNELS_FOR_FORMAT[f]) {
      if (ch === "reddit" && !hasOpenWeight) continue;
      out.push({ format: f, channel: ch });
    }
  }
  return out;
}

// 본문 속 aib.vote 언급(URL형/맨몸형)을 그 채널의 UTM 링크로 치환 — 태그(#aib)는 건드리지 않는다.
// 도메인 뒤에는 URL의 path/query/fragment에 쓸 수 있는 ASCII 문자만 허용한다.
// 따라서 `aib.vote에서`, `aib.vote,` 같은 자연어의 조사·문장부호는 보존된다.
// i: 대문자 표기(AIB.VOTE)도 치환 · 좌측 경계: myaib.vote 같은 단어 중간 오치환 방지.
const AIB_MENTION = /(?<![A-Za-z0-9.-])(?:https?:\/\/)?(?:www\.)?aib\.vote(?:\/[A-Za-z0-9._~%!$&'*+;=:@/-]*)?(?:\?[A-Za-z0-9._~%!$&'*+;=:@/?-]*)?(?:#[A-Za-z0-9._~%!$&'*+;=:@/?-]*)?/gi;
function applyUtmLink(text: string, link: string): string {
  // path가 문장 끝에 올 때 삼켜진 마침표 등 꼬리 문장부호는 링크 밖으로 되돌린다
  return text.replace(AIB_MENTION, (m) => link + (m.match(/[.,;:!?'")]+$/)?.[0] ?? ""));
}

/** voice.md 체크리스트의 기계적 항목을 결정적으로 강제 (이모지·긴 대시·ㅋㅋ→ㅎㅎ). */
export function sanitizeVoice(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|[\uFE0F\u200D\u20E3]/gu, "") // 이모지·국기·키캡·ZWJ 잔재까지
    .replace(/\s*—\s*/g, ", ") // 긴 대시 금지 — 쉼표로
    .replace(/ㅋ{2,}/g, "ㅎㅎ"); // 웃음은 ㅎㅎ
}

/**
 * 콘텐츠 골자 → 채널별 완성 카피. 비율·2단·AI라벨 등 고정 규칙은 코드가 채운다.
 * 한 번에 10건씩 요구하면 LLM이 조합을 빠뜨리므로 포맷별로 나눠 호출하고,
 * 누락 조합은 1회 재요청한다. 그래도 빠진 건 warnings로 보고(조용한 누락 금지).
 */
export async function renderPerChannel(
  topic: FactoryTopic,
  source: FactorySource,
  pieces: ContentPiece[],
  formats: FormatKind[],
  campaign: string
): Promise<{ outputs: ChannelOutput[]; warnings: string[] }> {
  const required = requiredOutputs(formats, pieces);
  if (!required.length) return { outputs: [], warnings: [] };
  const [voice, dist] = await Promise.all([voiceRules(), distributionRules()]);

  const warnings: string[] = [];
  const formatGroups = [...new Set(required.map((r) => r.format))];
  // 포맷 그룹은 서로 독립 — 병렬 실행 (글전용/쇼츠 각 ~10초 → 동시)
  const groupResults = await Promise.all(formatGroups.map(async (format) => {
    const outputs: ChannelOutput[] = [];
    const video = format === "shorts" || format === "ugc_demo";
    const sys = [
      "You are the channel copywriter for aib.vote promotional content (한국어, Reddit만 영어).",
      "콘텐츠 골자(pieces)를 요청된 채널 각각의 완성 카피로 변형한다. required 목록의 채널마다 정확히 1개씩, 빠짐없이 출력한다.",
      "",
      "채널 규칙:",
      '- threads/x는 parts 2개(2단 구성)로 출력 (parts[0]=훅+태그 게시물, parts[1]=풀본문) — body는 parts[0]과 동일하게.',
      "- youtube는 title 필수 (짧은 콘셉트 + 영문 해시태그).",
      "- dcinside/naver_cafe: 자극적 제목(title) + 짧은 본문 + 링크. 허위·과장 금지.",
      "- reddit: 영어, 홍보 티 최소, 데이터 중심.",
      `- 모든 카피 끝에 "${AIB_CTA}" 또는 aib.vote 링크 (인스타 릴스는 링크 대신 태그만).`,
      "- tags는 # 없이 단어만 배열로.",
      `- 모든 출력의 format 필드는 "${format}"로 고정.`,
      "",
      voice,
      ...(video ? ["", dist] : []),
      "",
      'Output ONLY this JSON: {"outputs":[{"channel":"threads","format":"' + format + '","title":"...","body":"...","tags":["AI","aib"],"parts":["...","..."]}]}',
    ].join("\n");

    let missing = required.filter((r) => r.format === format).map((r) => r.channel);
    for (let attempt = 0; attempt < 2 && missing.length; attempt++) {
      // 시도 실패(파싱·일시 장애)는 이 그룹의 warnings로 강등 — 다른 그룹/전체 배치를 죽이지 않는다
      let items: z.infer<typeof zChannelItem>[];
      try {
        const out = await factoryLlm(zChannelOut, sys, JSON.stringify({ topic: topic.title, searchMode: source.searchMode, pieces, format, required: missing }), 8000);
        items = out.outputs.flatMap((raw) => {
          const r = zChannelItem.safeParse(raw);
          return r.success ? [r.data] : []; // 불량 항목만 버림
        });
      } catch {
        continue;
      }
      for (const o of items) {
        // 이 호출은 단일 포맷 그룹 — format 필드는 LLM 드리프트와 무관하게 코드가 강제한다
        if (!missing.includes(o.channel)) continue;
        missing = missing.filter((c) => c !== o.channel);
        const utm = CHANNEL_UTM[o.channel];
        const link = buildAibLink({ ...utm, content: utmContentFor(format, o.channel), campaign });
        const clean = (t: string) => applyUtmLink(sanitizeVoice(t), link);
        outputs.push({
          ...o,
          format,
          title: o.title ? clean(o.title) : o.title,
          body: clean(o.body),
          parts: o.parts?.map(clean),
          link,
          aspectRatio: video ? CHANNEL_SPECS[o.channel].aspect : undefined,
        });
      }
    }
    return { outputs, missing, format };
  }));
  const outputs = groupResults.flatMap((g) => g.outputs);
  for (const g of groupResults) {
    if (g.missing.length) warnings.push(`${g.format} 카피 누락: ${g.missing.join(", ")} — '카피 다시 생성'으로 재시도하세요.`);
  }
  return { outputs, warnings };
}

// ── 쇼츠 페이지 명세 — 유형별 컷 구조 (+ 엔드카드) ──────────────────────────────
interface ShortsCut {
  visual: string;
  motion: string;
  transition: string;
  role: string;
}

// 기본(거짓말·속도 등): 훅 → A답 → B답 → 반전 → 교훈. 반전이 스포일러라 팩트는 뒤에서 공개.
const SHORTS_STRUCTURE: ShortsCut[] = [
  { visual: "fullscreen-title", motion: "whip-zoom-in", transition: "cut", role: "훅 — 질문을 던진다 (궁금증 유발)" },
  { visual: "quote-card", motion: "drift-up", transition: "cut", role: "모델A의 답 (짧은 인용)" },
  { visual: "quote-card", motion: "drift-up", transition: "whip-pan", role: "모델B의 답 (짧은 인용, A와 대비)" },
  { visual: "big-stat", motion: "caption-pop", transition: "glitch", role: "반전 — 실제 사실/결과 (숫자·핵심 강조)" },
  { visual: "split-media-text", motion: "ken-burns-zoom", transition: "zoom-blur", role: "교훈 — 하나만 믿으면 안 되는 이유" },
];

// 의견 대립(텍스트 의견 비교): 반전이 없으므로 제목 바로 다음에 배경 팩트를 깔아준다.
const OPINION_STRUCTURE: ShortsCut[] = [
  { visual: "fullscreen-title", motion: "whip-zoom-in", transition: "cut", role: "훅 — 질문을 던진다 (궁금증 유발)" },
  { visual: "split-media-text", motion: "ken-burns-zoom", transition: "cut", role: "배경 팩트 — 주제와 질문(프롬프트)에 깔린 사실을 한 줄로 요약 (무엇을 물었고 어떤 조건인지, 검색 off/on 포함)" },
  { visual: "quote-card", motion: "drift-up", transition: "cut", role: "모델A의 의견 (짧은 인용)" },
  { visual: "quote-card", motion: "drift-up", transition: "whip-pan", role: "모델B의 의견 (A와 정반대 지점이 드러나게)" },
  { visual: "big-stat", motion: "caption-pop", transition: "glitch", role: "대립 핵심 — 두 의견이 갈리는 지점을 한 문장/키워드로" },
  { visual: "split-media-text", motion: "ken-burns-zoom", transition: "zoom-blur", role: "투표 유도 — 당신은 누구 편? (aib.vote에서 직접 비교 권유)" },
];

const shortsStructure = (piece: ContentPiece): ShortsCut[] => (piece.type === "opinion_clash" ? OPINION_STRUCTURE : SHORTS_STRUCTURE);

const zShortsOut = z.object({
  pages: z.array(z.object({ caption: z.string(), vo: z.string(), imagePrompt: z.string() })),
  endcardVo: z.string().optional(),
});

export interface ShortsSpec {
  pages: AdPage[];
  endcardVo?: string;
}

/** 콘텐츠 골자 → 쇼츠 컷 명세(자막/VO/이미지 프롬프트) — 유형별 구조. 렌더·TTS·이미지는 에디터에서. */
export async function buildShortsSpec(topic: FactoryTopic, source: FactorySource, piece: ContentPiece): Promise<ShortsSpec> {
  const structure = shortsStructure(piece);
  const voice = await voiceRules();
  const sys = [
    "You are a short-form (15-30s) ad scriptwriter for aib.vote (9:16 vertical).",
    `고정된 ${structure.length}컷 구조에 맞춰 각 컷의 caption(화면 자막)과 vo(내레이션), imagePrompt를 쓴다.`,
    "",
    `컷 구조 (순서 고정, 정확히 ${structure.length}개 출력):`,
    ...structure.map((s, i) => `${i + 1}. ${s.role}`),
    "",
    "규칙:",
    "- caption: 한국어, 20자 이내, 펀치있게. 인용 컷은 모델명과 짧은 답 인용.",
    "- vo: 자연스러운 구어체 한국어, 컷당 2-4초(15-30음절). 검색 조건(off/on)을 훅이나 교훈에 명시.",
    "- 신뢰성: 모델 답 속 수치는 \"모델이 그렇게 답했다\"로. factNote만 사실로 쓸 수 있다.",
    "- imagePrompt: vivid English image-gen prompt, vertical 9:16, no text in image. hookImageHint가 있으면 1번 컷(훅)의 imagePrompt는 그 컨셉을 따른다.",
    "- endcardVo: 마지막 투표 유도 한 마디 (선택).",
    "",
    voice,
    "",
    'Output ONLY this JSON: {"pages":[{"caption":"...","vo":"...","imagePrompt":"..."}],"endcardVo":"..."}',
  ].join("\n");
  const user = JSON.stringify({
    topic: topic.title,
    piece,
    question: source.question,
    searchMode: source.searchMode,
    modelA: source.modelA,
    modelB: source.modelB,
    factNote: source.factNote ?? null,
    hookImageHint: topic.imagePrompt ?? null, // 주제 선정 때 추천된 훅 이미지 컨셉 — 1번 컷에 반영
  });
  const out = await factoryLlm(zShortsOut, sys, user);
  if (out.pages.length < structure.length) throw new Error(`쇼츠 컷이 ${out.pages.length}개만 생성됐습니다 — 다시 시도해 주세요.`);
  const pages: AdPage[] = structure.map((s, i) => ({
    ...newAdPage("image"),
    visualTemplateId: s.visual,
    motionTemplateId: s.motion,
    transitionTemplateId: s.transition,
    caption: sanitizeVoice(out.pages[i].caption), // 화면 자막도 말투 체크리스트(이모지·긴대시) 준수
    vo: sanitizeVoice(out.pages[i].vo),
    imagePrompt: out.pages[i].imagePrompt,
  }));
  return { pages, endcardVo: out.endcardVo ? sanitizeVoice(out.endcardVo) : out.endcardVo };
}
