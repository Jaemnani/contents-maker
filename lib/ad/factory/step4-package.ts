// STEP 4 · 유형별 패키징 — 소재(aib.vote 비교 결과)로 각 콘텐츠 유형의 골자를 만든다.
// 되는 유형만 만들고(SKILL 규칙 2), 말투는 voice.md를 프롬프트로 주입한다.
import "server-only";
import { z } from "zod";
import { zContentType, type ContentPiece, type ContentType, type FactorySource, type FactoryTopic } from "@/lib/ad/schema";
import { factoryLlm } from "@/lib/ad/factory/llm";
import { voiceRules } from "@/lib/ad/factory/rules/voice";
import { AIB_URL, CONTENT_TYPE_LABELS } from "@/lib/ad/factory/presets";

const zOut = z.object({
  pieces: z.array(z.object({ type: zContentType, hook: z.string(), body: z.string() })),
});

// 유형별 후킹 앵글 (SKILL STEP4)
const TYPE_ANGLES: Record<ContentType, string> = {
  lie_speed: '후킹 앵글: "어느 AI가 더 뻔뻔하게 거짓말할까?" / "속도 vs 정확도, 승자는?"',
  open_weight: '후킹 앵글: "무료 오픈모델이 유료를 이겼다" — 수치·근거 강조',
  opinion_clash: '후킹 앵글: "같은 질문, 정반대 답. 당신은 누구 편?" — 투표 유도',
};

/** 소재 → 유형별 콘텐츠 골자(hook/body). 구조는 [후킹 → 비교 핵심 → 투표 CTA]. */
export async function packageByType(topic: FactoryTopic, source: FactorySource, types: ContentType[]): Promise<ContentPiece[]> {
  const voice = await voiceRules();
  const sys = [
    "You are the copywriter for aib.vote (AI 모델 1:1 비교·투표 플랫폼) promotional content.",
    "주어진 실제 비교 결과(소재)로 각 콘텐츠 유형의 골자(hook + body)를 한국어로 작성한다.",
    "",
    "각 유형의 앵글:",
    ...types.map((t) => `- ${t} (${CONTENT_TYPE_LABELS[t]}): ${TYPE_ANGLES[t]}`),
    "",
    "규칙:",
    "1) 구조: [후킹 → 비교 핵심 → 투표 유도]. body 마지막 줄에 CTA는 넣지 말 것 (채널 변형 단계에서 붙인다).",
    `2) 콘텐츠에는 검색 조건(searchMode off/on)을 반드시 자연스럽게 명시한다 (예: "검색 끈 AI한테 물어봄").`,
    "3) 신뢰성 원칙: 모델 답변 속 수치·주장은 검증 전에는 사실로 단정하지 않는다 — \"모델이 이렇게 자신 있게 답했다\"(태도·현상)로 표현한다. factNote가 있으면 그것만 사실로 쓸 수 있다.",
    "4) 비교 결과를 왜곡·과장하지 않는다. 실존 인물·경쟁사 비방 금지.",
    "5) 요청된 유형 각각에 대해 정확히 1개씩 만든다.",
    "",
    voice,
    "",
    'Output ONLY this JSON: {"pieces":[{"type":"lie_speed","hook":"...","body":"..."}]}',
  ].join("\n");
  const user = JSON.stringify({
    topic: topic.title,
    question: source.question,
    searchMode: source.searchMode,
    modelA: source.modelA,
    modelB: source.modelB,
    factNote: source.factNote ?? null,
    types,
  });
  const out = await factoryLlm(zOut, sys, user);
  // 요청 유형만, 유형당 1개 — LLM 드리프트는 조용히 버린다
  const seen = new Set<ContentType>();
  const pieces: ContentPiece[] = [];
  for (const p of out.pieces) {
    if (!types.includes(p.type) || seen.has(p.type)) continue;
    seen.add(p.type);
    pieces.push({ ...p, ctaUrl: AIB_URL });
  }
  if (!pieces.length) throw new Error("콘텐츠 골자 생성 실패 — 다시 시도해 주세요.");
  return pieces;
}
