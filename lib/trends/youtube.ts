// YouTube Data API v3 (free). mostPopular by region, or keyword search.
import "server-only";
import { getYoutubeKey } from "@/lib/env";
import { langToRegion, decodeEntities, type TrendProvider, type TrendItem } from "./types";

export const youtubeProvider: TrendProvider = {
  id: "youtube",
  label: "YouTube 인기",
  available: () => !!getYoutubeKey(),
  async getTrends({ lang, query, limit = 20 }) {
    const key = getYoutubeKey();
    if (!key) return [];
    const region = langToRegion[lang];
    if (query) {
      const u = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${limit}&regionCode=${region}&q=${encodeURIComponent(query)}&key=${key}`;
      const j = await (await fetch(u)).json();
      if (j.error) throw new Error(j.error.message);
      return (j.items ?? []).map(
        (it: { snippet?: { title?: string }; id?: { videoId?: string } }): TrendItem => ({
          term: decodeEntities(it.snippet?.title ?? ""),
          kind: "video",
          source: "youtube",
          url: it.id?.videoId ? `https://youtu.be/${it.id.videoId}` : undefined,
        })
      );
    }
    const u = `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&maxResults=${limit}&regionCode=${region}&key=${key}`;
    const j = await (await fetch(u)).json();
    if (j.error) throw new Error(j.error.message);
    return (j.items ?? []).map(
      (it: { snippet?: { title?: string }; id?: string }): TrendItem => ({
        term: decodeEntities(it.snippet?.title ?? ""),
        kind: "top",
        source: "youtube",
        url: it.id ? `https://youtu.be/${it.id}` : undefined,
      })
    );
  },
};
