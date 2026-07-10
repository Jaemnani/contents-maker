// STEP 6 · 출력 — 발행 전 사실확인 체크(매 실행 필수·고정 항목) + 배포 플랜.
// 원칙: 검증 전에는 사실로 단정하지 않는다. L1은 자동 웹 검증 없이 목록화·판정만 하고
// "실제 확인 필요" 항목으로 사람에게 넘긴다 (L2+에서 web/RSS 자동 확인으로 확장).
import "server-only";
import { z } from "zod";
import {
  zFactCheckItem,
  type ChannelOutput,
  type ContentPiece,
  type ContentType,
  type FactCheckItem,
  type FactorySource,
  type FormatKind,
  type PublishPlan,
} from "@/lib/ad/schema";
import { factoryLlm } from "@/lib/ad/factory/llm";
import { CONTENT_TYPE_LABELS } from "@/lib/ad/factory/presets";

const zOut = z.object({ items: z.array(zFactCheckItem) });

/** 모델 답변·카피 속 구체적 수치·고유명사·인과주장을 목록화하고 단정 여부를 판정한다. */
export async function factCheck(source: FactorySource, pieces: ContentPiece[]): Promise<FactCheckItem[]> {
  const sys = [
    "You are a pre-publish fact-check auditor for AI-comparison content (한국어).",
    "모델 답변과 카피에서 구체적 수치·고유명사·인과주장을 전부 목록화한다.",
    "각 항목에 대해 카피가 그것을 '사실로 단정'(fact)했는지, \"모델이 그렇게 답했다\"로만 표현(model_said)했는지 판정한다.",
    "verified는 항상 false로 둔다 (자동 검증 없음 — 사람이 확인). note에는 어떻게 확인하면 되는지 한 줄.",
    'Output ONLY this JSON: {"items":[{"claim":"...","treatedAs":"model_said","verified":false,"note":"..."}]}',
  ].join("\n");
  const user = JSON.stringify({ modelA: source.modelA, modelB: source.modelB, factNote: source.factNote ?? null, pieces });
  const out = await factoryLlm(zOut, sys, user);
  return out.items.map((i) => ({ ...i, verified: false }));
}

/** 배포 일정 제안 + 로테이션 메모(이번에 못 만든 유형 → 다음 실행 우선). */
export function buildPublishPlan(outputs: ChannelOutput[], factCheckItems: FactCheckItem[], selectedFormats: FormatKind[], madeTypes: ContentType[], warnings: string[] = []): PublishPlan {
  const hasVideo = selectedFormats.includes("shorts") || selectedFormats.includes("ugc_demo");
  const hasStatic = selectedFormats.includes("card_news") || selectedFormats.includes("single_image");
  const schedule = [
    "글전용: 즉시 발행 (제작비 0, 시의성 우선)",
    hasStatic ? "정적(카드뉴스/이미지): 비주얼 제작 후 당일 예약 발행" : null,
    hasVideo ? "영상(쇼츠): 이미지·TTS·렌더 후 발행 — 유튜브 쇼츠를 먼저 올려 URL 확보 후 X 등 링크 되는 곳에 삽입" : null,
  ]
    .filter(Boolean)
    .join("\n");
  const allTypes: ContentType[] = ["lie_speed", "open_weight", "opinion_clash"];
  const missing = allTypes.filter((t) => !madeTypes.includes(t));
  const rotationMemo = missing.length
    ? `이번에 못 만든 유형: ${missing.map((t) => CONTENT_TYPE_LABELS[t]).join(", ")} — 다음 실행에서 우선 채울 것`
    : "3개 유형 모두 제작됨 — 로테이션 부담 없음";
  return { outputs, factCheck: factCheckItems, schedule, rotationMemo, warnings: warnings.length ? warnings : undefined };
}
