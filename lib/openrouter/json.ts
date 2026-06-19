// Robust JSON parsing for LLM chat responses (shared by topic curation and ad compose).
// Strips code fences and recovers truncated arrays by trimming to the last complete object.

export function parseJsonLoose(content: string): unknown {
  let s = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(s);
  } catch {
    const cut = s.lastIndexOf("}");
    if (cut > 0) {
      s = s.slice(0, cut + 1) + "]}";
      try {
        return JSON.parse(s);
      } catch {
        /* fall through */
      }
    }
    throw new Error("invalid JSON");
  }
}
