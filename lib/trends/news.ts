// NewsAPI.org. top-headlines by country, or keyword search (everything).
import "server-only";
import { getNewsKey } from "@/lib/env";
import { langToRegion, decodeEntities, type TrendProvider, type TrendItem } from "./types";
import type { Language } from "@/lib/types";

type Article = { title?: string; url?: string; source?: { name?: string } };
// NewsAPI top-headlines has no ko/ja country coverage; /everything works for any query text
// but its `language` param doesn't accept ko/ja — so we search without a language filter.
const NEWS_SEED: Record<Language, string> = { ko: "한국", ja: "日本", en: "news" };

export const newsProvider: TrendProvider = {
  id: "news",
  label: "뉴스 헤드라인",
  available: () => !!getNewsKey(),
  async getTrends({ lang, query, limit = 20 }) {
    const key = getNewsKey();
    if (!key) return [];
    const base = "https://newsapi.org/v2";
    const everything = (q: string) =>
      `${base}/everything?q=${encodeURIComponent(q)}&sortBy=publishedAt&pageSize=${limit}&apiKey=${key}`;
    const grab = async (u: string): Promise<Article[]> => {
      const j = await (await fetch(u)).json();
      if (j.status === "error") throw new Error(j.message);
      return j.articles ?? [];
    };

    let articles: Article[];
    if (query) {
      articles = await grab(everything(query));
    } else {
      // en: country=us has good coverage; ko/ja: country returns nothing → localized search fallback.
      articles = await grab(`${base}/top-headlines?country=${langToRegion[lang].toLowerCase()}&pageSize=${limit}&apiKey=${key}`);
      if (!articles.length) articles = await grab(everything(NEWS_SEED[lang]));
    }
    return articles.map(
      (a): TrendItem => ({
        term: decodeEntities(a.title ?? ""),
        kind: "news",
        source: a.source?.name ?? "news",
        url: a.url,
      })
    );
  },
};
