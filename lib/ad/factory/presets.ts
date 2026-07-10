// aib 콘텐츠 팩토리 — 순수 데이터 프리셋 (client-safe, no server imports).
// SKILL.md의 표(추천 프리셋 · 카테고리→유형 친화도 · 포맷→채널 매핑)를 코드 상수로 옮긴 것.
// 말투/배포 "규칙 문장"은 여기 두지 않는다 — rules/*.ts가 md 파일을 읽어 프롬프트로 주입한다.
import type { ContentType, FactoryCategory, FormatKind, FactoryChannel } from "@/lib/ad/schema";

export const AIB_URL = "https://aib.vote";
export const AIB_CTA = "직접 투표해보기 → aib.vote";

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  lie_speed: "거짓말·속도 비교",
  open_weight: "오픈웨이트 vs 유료",
  opinion_clash: "모델 간 의견 대립",
};
export const CONTENT_TYPE_HINTS: Record<ContentType, string> = {
  lie_speed: "정답이 있는 사실형 질문 — 정확도/속도를 겨룰 수 있어야 성립",
  open_weight: "비교 대상 중 하나가 오픈웨이트 모델이어야 성립",
  opinion_clash: "두 모델이 상반된 답을 낼 여지 — 견해·판단·창작형 질문",
};

export const CATEGORY_LABELS: Record<FactoryCategory, string> = {
  ai: "AI관련",
  economy: "경제",
  society: "사회",
  life_culture: "생활/문화",
  it_science: "IT/과학",
  world: "세계",
};

/** 카테고리 → 잘 붙는 유형 (후보 태깅 참고용, 절대 규칙 아님 — SKILL STEP1 표) */
export const CATEGORY_TYPE_AFFINITY: Record<FactoryCategory, ContentType[]> = {
  ai: ["open_weight", "opinion_clash", "lie_speed"],
  economy: ["lie_speed"],
  society: ["opinion_clash"],
  life_culture: ["opinion_clash", "lie_speed"],
  it_science: ["open_weight", "lie_speed"],
  world: ["lie_speed", "opinion_clash"],
};

export const FORMAT_LABELS: Record<FormatKind, string> = {
  text_only: "글전용 (제작비 0)",
  card_news: "카드뉴스",
  single_image: "단일 이미지",
  shorts: "쇼츠 (15~30s)",
  ugc_demo: "UGC·데모 영상",
};

/** 유형별 추천 포맷 프리셋 — 기본 체크 상태로 제시 (SKILL STEP2 표). 글전용은 항상 포함. */
export const RECOMMENDED_FORMATS: Record<ContentType, FormatKind[]> = {
  lie_speed: ["shorts", "text_only"],
  open_weight: ["card_news", "text_only"],
  opinion_clash: ["shorts", "text_only"],
};

/** 선택된 유형들의 추천 포맷 합집합 (글전용 보장). */
export function recommendFormats(types: ContentType[]): FormatKind[] {
  const set = new Set<FormatKind>(["text_only"]);
  for (const t of types) for (const f of RECOMMENDED_FORMATS[t]) set.add(f);
  return [...set];
}

export const CHANNEL_LABELS: Record<FactoryChannel, string> = {
  dcinside: "디시 (AI갤)",
  naver_cafe: "네이버 카페",
  threads: "스레드",
  x: "X (트위터)",
  instagram: "인스타그램",
  youtube: "유튜브 쇼츠",
  naver_clip: "네이버 클립",
  tiktok: "틱톡",
  reddit: "Reddit",
};

/** 포맷 → 채널 매핑 (SKILL STEP5 표). 쇼츠는 shortform_distribution.md의 6플랫폼. */
export const CHANNELS_FOR_FORMAT: Record<FormatKind, FactoryChannel[]> = {
  text_only: ["dcinside", "naver_cafe", "threads", "x"],
  card_news: ["instagram", "naver_cafe"],
  single_image: ["threads", "x", "instagram"],
  shorts: ["youtube", "instagram", "tiktok", "threads", "x", "naver_clip"],
  ugc_demo: ["youtube"],
};

/** 채널별 고정 규칙(코드가 보장하는 부분) — 말투·본문 구성은 rules가 md로 주입. */
export const CHANNEL_SPECS: Record<FactoryChannel, { aspect?: "9:16" | "4:5"; twoPart?: boolean; note?: string }> = {
  dcinside: {},
  naver_cafe: {},
  threads: { aspect: "9:16", twoPart: true },
  x: { aspect: "9:16", twoPart: true },
  instagram: { aspect: "4:5", note: "릴스는 4:5 리프레임 필요, 링크 미작동 — 태그 약 12개" },
  youtube: { aspect: "9:16" },
  naver_clip: { aspect: "9:16", note: "한글 태그 약 5개" },
  tiktok: { aspect: "9:16", note: "AI 생성 라벨 ON 필수 (게시 후 해제 불가)" },
  reddit: { note: "영어, 홍보 티 최소, 데이터 중심" },
};

export const STAGE_LABELS: Record<string, string> = {
  topic_candidates: "주제 후보",
  format_preset: "포맷 확정",
  awaiting_source: "소재 입력 대기",
  packaged: "콘텐츠 생성 완료",
  rendered: "렌더 완료",
  awaiting_publish: "발행 대기",
  published: "발행 완료",
};
