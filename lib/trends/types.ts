// Pluggable trend providers → topic seeds.
import type { Language } from "@/lib/types";

export type TrendKind = "rising" | "breakout" | "top" | "news" | "video";

export interface TrendItem {
  term: string;
  kind: TrendKind;
  score?: number;
  source: string;
  url?: string;
}

export interface TrendFetchOpts {
  lang: Language;
  query?: string;
  limit?: number;
}

export interface TrendProvider {
  id: string;
  label: string;
  available(): boolean; // key present?
  getTrends(opts: TrendFetchOpts): Promise<TrendItem[]>;
}

export const langToRegion: Record<Language, string> = { ko: "KR", ja: "JP", en: "US" };
export const langToHl: Record<Language, string> = { ko: "ko", ja: "ja", en: "en" };

// API titles (YouTube/News) arrive HTML-escaped (&quot; &#39; &amp; …). Decode for clean terms.
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}
