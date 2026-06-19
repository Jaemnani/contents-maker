// SerpApi Google Trends (paid). With a seed query → RELATED_QUERIES rising/breakout;
// without → trending-now searches for the region.
import "server-only";
import { getSerpApiKey } from "@/lib/env";
import { langToRegion, langToHl, type TrendProvider, type TrendItem } from "./types";

export const serpapiProvider: TrendProvider = {
  id: "serpapi",
  label: "Google Trends (급상승)",
  available: () => !!getSerpApiKey(),
  async getTrends({ lang, query, limit = 20 }) {
    const key = getSerpApiKey();
    if (!key) return [];
    const geo = langToRegion[lang];
    if (query) {
      const u = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(query)}&data_type=RELATED_QUERIES&geo=${geo}&hl=${langToHl[lang]}&api_key=${key}`;
      const j = await (await fetch(u)).json();
      if (j.error) throw new Error(j.error);
      const rising = j.related_queries?.rising ?? [];
      return rising.slice(0, limit).map(
        (r: { query?: string; value?: string; extracted_value?: number }): TrendItem => ({
          term: r.query ?? "",
          kind: typeof r.value === "string" && /breakout/i.test(r.value) ? "breakout" : "rising",
          score: r.extracted_value,
          source: "google-trends",
        })
      );
    }
    const u = `https://serpapi.com/search.json?engine=google_trends_trending_now&geo=${geo}&api_key=${key}`;
    const j = await (await fetch(u)).json();
    if (j.error) throw new Error(j.error);
    const list = j.trending_searches ?? j.daily_searches ?? [];
    return list.slice(0, limit).map(
      (t: { query?: string; title?: string | { query?: string } }): TrendItem => ({
        term: typeof t.query === "string" ? t.query : (typeof t.title === "object" ? t.title?.query : t.title) ?? "",
        kind: "rising",
        source: "google-trends",
      })
    );
  },
};
