// STEP 1 · 주제 후보 추천 [반자동 → 사용자 택1] — SKILL.md STEP1.
// 무료 트렌드 소스(YouTube 인기·뉴스)에서 6개 카테고리로 화제를 모으고, LLM이
// 3중 스코어링(트렌드·제품적합·후킹) + 유형 태깅해 상위 3개 후보를 만든다.
// 카테고리가 최소 2개 이상 섞이도록 하고, 최종 선택은 항상 사람이 한다.
// 신선도: YouTube 인기·뉴스 헤드라인은 "지금 인기" 피드라 본질적으로 최신(≈48h)이고,
// 카테고리별 뉴스 검색은 publishedAt 정렬 상위만 쓴다.
import "server-only";
import { z } from "zod";
import { getTrends, listProviders } from "@/lib/trends";
import type { TrendItem } from "@/lib/trends/types";
import { zFactoryTopic, type FactoryCategory, type FactoryTopic } from "@/lib/ad/schema";
import { factoryLlm } from "@/lib/ad/factory/llm";
import { CATEGORY_LABELS } from "@/lib/ad/factory/presets";

const zOut = z.object({ candidates: z.array(zFactoryTopic).min(1).max(3) });

// 카테고리별 뉴스 검색어 (NewsAPI everything, publishedAt 정렬)
const CATEGORY_QUERIES: Record<FactoryCategory, string> = {
  ai: "AI 인공지능 모델",
  economy: "경제 환율 주가",
  society: "사회 논란",
  life_culture: "밈 화제 연예",
  it_science: "IT 기술 과학",
  world: "국제 세계",
};

interface PoolItem {
  term: string;
  source: string;
  categoryHint?: FactoryCategory; // 검색어 기반 힌트 — LLM이 재분류 가능
}

/** 가용한 무료 소스에서 카테고리별 화제 풀을 모은다 (실패한 소스는 건너뜀). */
async function collectPool(): Promise<PoolItem[]> {
  const available = new Set(listProviders().map((p) => p.id));
  if (!available.size) {
    throw new Error("트렌드 소스 API 키가 없습니다 (.env.local의 YOUTUBE_API_KEY / NEWS_API_KEY) — 아래에서 주제를 직접 입력하세요.");
  }
  const tasks: Promise<PoolItem[]>[] = [];
  if (available.has("youtube")) {
    tasks.push(
      getTrends("youtube", { lang: "ko", limit: 20 }).then((items) => items.map((i: TrendItem) => ({ term: i.term, source: "YouTube 인기" })))
    );
  }
  if (available.has("news")) {
    tasks.push(
      getTrends("news", { lang: "ko", limit: 15 }).then((items) => items.map((i: TrendItem) => ({ term: i.term, source: i.source })))
    );
    for (const [cat, q] of Object.entries(CATEGORY_QUERIES) as [FactoryCategory, string][]) {
      tasks.push(
        getTrends("news", { lang: "ko", query: q, limit: 8 }).then((items) =>
          items.map((i: TrendItem) => ({ term: i.term, source: i.source, categoryHint: cat }))
        )
      );
    }
  }
  const settled = await Promise.allSettled(tasks);
  const pool = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  // dedupe + 짧은 노이즈 제거
  const seen = new Set<string>();
  return pool.filter((p) => p.term.length >= 6 && !seen.has(p.term) && seen.add(p.term)).slice(0, 70);
}

/** 트렌드 풀 → 후보 3개 (스코어·유형·근거 포함). 실패 시 한국어 에러로 UI에 그대로 노출. */
export async function pickTopicCandidates(): Promise<FactoryTopic[]> {
  const pool = await collectPool();
  if (pool.length < 3) throw new Error("수집된 화제가 너무 적습니다 — 잠시 후 다시 시도하거나 주제를 직접 입력하세요.");
  const sys = [
    "You are the topic curator for aib.vote (AI 모델 1:1 비교·투표 플랫폼) promotional content.",
    "실시간 화제 목록에서, aib.vote 비교 콘텐츠로 변환하기 좋은 주제 후보 3개를 고른다.",
    "",
    "핵심 발상: 카테고리 = 소재의 출처, aib.vote = 비교 장치. 어떤 화제든 \"이 주제를 여러 AI에게 물어보면?\"으로 변환한다. 일반 대중 화제일수록 잠재 도달이 크다.",
    "",
    "규칙:",
    `1) category는 다음 중 하나: ${Object.entries(CATEGORY_LABELS).map(([k, v]) => `${k}(${v})`).join(", ")}. 후보 3개의 카테고리가 서로 다르게 최소 2개 이상 섞일 것 (한 카테고리 몰림 방지).`,
    '2) title은 원 헤드라인 복사가 아니라 "AI 비교 앵글이 보이는" 주제 문장으로 재작성 (예: "환율 급등, 어느 AI가 방향을 맞혔나").',
    "3) scores: trend(지금 사람들이 찾는가)·fit(aib.vote 비교 프롬프트로 흥미롭게 변환되는가)·hook(놀라운 반전·논쟁이 있는가)을 각각 high/mid/low로.",
    "4) supportedTypes: 성립하는 유형만 — lie_speed(정답 있는 사실형 질문), open_weight(오픈웨이트 모델 비교가 자연스러움), opinion_clash(견해·판단이 갈릴 질문). typeNote에 각 유형이 되는 근거 한 줄.",
    "5) sourceNote: 어떤 화제에서 왔는지 근거 한 줄 (원 헤드라인 + 출처).",
    "6) 스코어 종합(trend > fit > hook 가중)이 높은 순으로 3개.",
    "",
    'Output ONLY this JSON: {"candidates":[{"title":"...","category":"economy","scores":{"trend":"high","fit":"high","hook":"mid"},"supportedTypes":["lie_speed"],"typeNote":"...","sourceNote":"..."}]}',
  ].join("\n");
  const out = await factoryLlm(zOut, sys, JSON.stringify({ pool }), 4000);
  const candidates = out.candidates.filter((c) => c.supportedTypes.length > 0).slice(0, 3);
  if (!candidates.length) throw new Error("후보 생성에 실패했습니다 — 다시 시도해 주세요.");
  return candidates;
}
