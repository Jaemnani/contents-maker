// Trend provider registry.
import "server-only";
import { youtubeProvider } from "./youtube";
import { newsProvider } from "./news";
import { serpapiProvider } from "./serpapi";
import type { TrendProvider, TrendFetchOpts, TrendItem } from "./types";

const PROVIDERS: TrendProvider[] = [youtubeProvider, newsProvider, serpapiProvider];

/** Providers that have an API key configured (shown in the UI). */
export function listProviders(): { id: string; label: string }[] {
  return PROVIDERS.filter((p) => p.available()).map((p) => ({ id: p.id, label: p.label }));
}

export async function getTrends(providerId: string, opts: TrendFetchOpts): Promise<TrendItem[]> {
  const p = PROVIDERS.find((x) => x.id === providerId);
  if (!p) throw new Error(`알 수 없는 트렌드 소스: ${providerId}`);
  if (!p.available()) throw new Error(`${p.label}의 API 키가 설정되지 않았습니다.`);
  const items = await p.getTrends(opts);
  // dedupe by term, drop empties
  const seen = new Set<string>();
  return items.filter((i) => i.term && !seen.has(i.term) && seen.add(i.term));
}
