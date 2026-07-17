// aib.vote/news 크롤러 — 자사 뉴스 큐레이션 페이지에서 오늘의 AI 뉴스를 가져온다.
// 페이지는 Next.js App Router라 데이터가 RSC flight 스트림(self.__next_f)에 실려 온다:
//   1) 모든 __next_f.push([1,"..."]) 문자열 청크를 JSON 언이스케이프해 이어붙이고
//   2) {"articles":[...]} 배열을 중괄호 매칭으로 잘라 파싱한 뒤
//   3) "$<id>" 참조(상세 본문)를 `<id>:T<hex>,` 텍스트 청크에서 해석한다.
// 사이트 개편으로 형태가 바뀌면 조용히 빈 배열을 주지 않고 한국어 에러를 던진다.
import "server-only";
import { z } from "zod";

export interface AibNewsItem {
  id: string;
  slug: string;
  title: string; // ko 우선, 없으면 en
  summary: string[]; // quick_summary (ko 우선)
  details?: string; // 상세 본문 (ko 우선) — 대본의 사실 근거
  source: string; // 원 기사 매체
  articleUrl?: string;
  aibUrl: string; // https://www.aib.vote/news/<slug>
  publishedAt: string; // YYYY-MM-DD
  keywords: string[];
}

const NEWS_URL = "https://www.aib.vote/news";
const CACHE_MS = 10 * 60 * 1000; // 목록 캐시 10분 — 패널을 여닫을 때마다 재크롤링하지 않게

const zLocaleSummary = z.object({
  title: z.string().optional(),
  details: z.string().optional(), // 인라인 텍스트 or "$ref"
  quick_summary: z.array(z.string()).optional(),
});
const zArticle = z.object({
  id: z.string(),
  slug: z.string(),
  article_url: z.string().optional(),
  title: z.string(),
  source: z.string().optional(),
  published_at: z.string(),
  keywords: z.array(z.string()).optional(),
  summaries: z.record(z.string(), zLocaleSummary).optional(),
});

let cache: { at: number; items: AibNewsItem[] } | null = null;

/** __next_f 문자열 청크들을 언이스케이프해 하나의 flight 스트림으로 잇는다. */
function flightStream(html: string): string {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]\)/g)].map((m) => m[1]);
  if (!chunks.length) throw new Error("aib.vote/news 페이지 형식이 바뀌었습니다 (flight 청크 없음) — 크롤러 업데이트가 필요합니다.");
  return chunks.map((c) => JSON.parse(`"${c}"`) as string).join("");
}

/** 스트림에서 {"articles":[...]} 의 배열 부분을 중괄호/대괄호 매칭으로 잘라낸다. */
function extractArticlesJson(stream: string): string {
  const key = '"articles":[';
  const at = stream.indexOf(key);
  if (at < 0) throw new Error("aib.vote/news에서 기사 목록을 찾지 못했습니다 — 페이지 형식 변경 여부를 확인하세요.");
  const start = at + key.length - 1; // '[' 위치
  let depth = 0;
  let inStr = false;
  for (let i = start; i < stream.length; i++) {
    const ch = stream[i];
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) return stream.slice(start, i + 1);
    }
  }
  throw new Error("aib.vote/news 기사 배열 파싱 실패 (괄호 불일치).");
}

/** "$3f" 형태의 flight 참조를 `<id>:T<hexlen>,본문` 텍스트 청크에서 해석한다. */
function resolveRef(stream: string, value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith("$")) return value; // 인라인 텍스트
  const id = value.slice(1);
  const m = new RegExp(`(?:^|(?<=[^0-9a-f]))${id}:T([0-9a-f]+),`).exec(stream);
  if (!m || m.index == null) return undefined;
  const start = m.index + m[0].length;
  const len = parseInt(m[1], 16); // T 뒤 16진수 = 본문 바이트 길이 (UTF-8)
  // 바이트 길이 기준으로 잘라야 한글에서 안 어긋난다. UTF-16 단위 수 ≤ UTF-8 바이트 수이므로
  // len 문자만 미리 잘라도 len 바이트를 항상 포함한다 (전체 스트림 복사 방지).
  const bytes = Buffer.from(stream.slice(start, start + len), "utf-8").subarray(0, len);
  return bytes.toString("utf-8");
}

const pick = <T>(loc: Record<string, T> | undefined, ...langs: string[]): T | undefined => {
  for (const l of langs) if (loc?.[l]) return loc[l];
  return undefined;
};

/** aib.vote/news 전체 기사 목록 (최신 페이지 기준, 10분 캐시). */
export async function fetchAibNews(): Promise<AibNewsItem[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.items;
  const res = await fetch(NEWS_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (shorts-maker news bot)" },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`aib.vote/news 요청 실패 (HTTP ${res.status})`);
  const stream = flightStream(await res.text());
  const raw: unknown = JSON.parse(extractArticlesJson(stream));
  if (!Array.isArray(raw)) throw new Error("aib.vote/news 기사 목록 형식이 예상과 다릅니다.");

  const items: AibNewsItem[] = [];
  for (const r of raw) {
    const a = zArticle.safeParse(r);
    if (!a.success) continue; // 형식이 다른 항목만 버림 — 전체는 살린다
    const ko = pick(a.data.summaries, "ko", "en", "ja");
    items.push({
      id: a.data.id,
      slug: a.data.slug,
      title: ko?.title || a.data.title,
      summary: ko?.quick_summary ?? [],
      details: resolveRef(stream, ko?.details),
      source: a.data.source ?? "unknown",
      articleUrl: a.data.article_url,
      aibUrl: `https://www.aib.vote/news/${a.data.slug}`,
      publishedAt: a.data.published_at,
      keywords: a.data.keywords ?? [],
    });
  }
  if (!items.length) throw new Error("aib.vote/news에서 기사를 하나도 파싱하지 못했습니다 — 페이지 형식 변경 여부를 확인하세요.");
  cache = { at: Date.now(), items };
  return items;
}

/** 오늘(서울) 발행 기사만 — 오늘자가 없으면 가장 최근 발행일 기사로 폴백. */
export async function fetchTodayAibNews(): Promise<{ items: AibNewsItem[]; date: string }> {
  const all = await fetchAibNews();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()); // YYYY-MM-DD
  const todays = all.filter((i) => i.publishedAt === today);
  if (todays.length) return { items: todays, date: today };
  const latest = all.map((i) => i.publishedAt).sort().at(-1)!;
  return { items: all.filter((i) => i.publishedAt === latest), date: latest };
}
