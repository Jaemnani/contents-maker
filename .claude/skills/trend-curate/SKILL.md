---
name: trend-curate
description: Turn raw trend terms into short-form "Same prompt, Different AI" comparison-topic candidates (headline/sub/comparePrompt) in ko/ja/en. Use when iterating on the curation prompt/schema or curating topics by hand.
---

# Trend Curation

This project auto-collects trend terms (YouTube / NewsAPI / SerpApi Google Trends) and an
LLM turns them into **comparison-topic candidates** for the "Same prompt, Different AI" format.

- **Runtime**: [`lib/topic/curate.ts`](../../../lib/topic/curate.ts) → `curateTopics(terms, language, max)`.
  Called by `POST /api/topic`. Uses the cheapest OpenRouter text model (`CHEAPEST_PRESETS.text[0]`).
- **Sources**: [`lib/trends/`](../../../lib/trends/) providers → `GET /api/trends?provider=&q=&lang=`.

This skill documents the **prompt routine + schema** so it can be tuned without re-reading the code.

## Output schema (zod-validated)

```jsonc
{ "candidates": [ {
  "term": "source keyword",
  "headline": { "ko": "...", "ja": "...", "en": "..." },  // punchy hook, <=10 words each
  "sub":      { "ko": "...", "ja": "...", "en": "..." },  // ONE short question, <=8 words
  "comparePrompt": "vivid English image-gen prompt, single scene, no text, <=30 words",
  "why": "one short reason (in the request language)"
} ] }
```

## Prompt routine (what the system prompt must enforce)

1. **Cluster / dedupe** near-duplicate terms.
2. **Filter** low-signal, sensitive, or non-visual items (politics, scandals, tragedies, pure text news).
3. **Keep** only terms that make a *visually interesting* AI image/video comparison.
4. **Rank** by short-form potential; return the top N.
5. Per candidate: short `headline`/`sub` in all three languages, plus a **single-scene** `comparePrompt`
   (the SAME prompt is fed to every model — never describe "one with X, the other with Y") and a short `why`.
6. Output ONLY the JSON object — no prose, no code fences.

## Robustness notes (already handled in curate.ts)

- `max_tokens: 4000` — verbose models truncate JSON at lower limits → parse fails → empty result.
- **Truncation recovery**: on parse failure, retry by trimming to the last complete `}` + `]}`.
- **Field-name drift**: weak models emit `headlines`/`prompt`/`keyword`; `normalize()` maps aliases
  (`headline|headlines|hook`, `comparePrompt|prompt|compare_prompt|imagePrompt`, `term|keyword|topic|title`, `why|reason`).
- `response_format: { type: "json_object" }` to bias toward valid JSON.

## When tuning

Edit the `systemPrompt()` in `lib/topic/curate.ts`. Keep strings SHORT (long subs/headlines blow the
token budget and hurt the start-card layout). If a stronger model is needed, change the model selection
there (still prefer a cheap tier per project convention).
