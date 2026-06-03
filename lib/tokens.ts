// Language-aware token estimation (concern #2).
// Korean/Japanese run ~1.8 tokens/char; Latin ~0.25 tokens/char.
// This is a pre-generation upper-bound estimate; actual cost comes from usage afterwards.
import type { Language } from "@/lib/types";

const TOKENS_PER_CHAR: Record<Language, number> = { ko: 1.8, ja: 1.8, en: 0.25 };
const DEFAULT_TOKENS_PER_CHAR = 0.25;

export function estimateTokens(text: string, language?: Language): number {
  const factor = language ? TOKENS_PER_CHAR[language] : DEFAULT_TOKENS_PER_CHAR;
  return Math.ceil(text.length * factor);
}

// Sum of the 5 text variants' max chars -> default output token budget (KO/JA).
// short100 + medium150 + thread300 + line500 + long1500 = 2550 chars * 1.8 ~= 4590
export const DEFAULT_TEXT_MAX_TOKENS = 5000;
