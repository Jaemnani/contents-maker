// Parse the 5-variant delimited text stream into structured variants (client-safe).
import { TEXT_VARIANTS } from "@/lib/channels";
import type { TextVariant } from "@/lib/types";

const DELIM_RE = /^===\s*([A-Za-z]+)\s*===\s*$/gm;

export function parseVariants(raw: string): Record<string, TextVariant> {
  const out: Record<string, TextVariant> = {};
  const matches = [...raw.matchAll(DELIM_RE)];
  for (let i = 0; i < matches.length; i++) {
    const id = matches[i][1].toLowerCase();
    const start = (matches[i].index ?? 0) + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? raw.length : raw.length;
    const text = raw.slice(start, end).trim();
    const spec = TEXT_VARIANTS.find((v) => v.id === id);
    out[id] = {
      text,
      chars: [...text].length, // unicode-aware char count (KO/JA)
      targetChannels: spec?.targetChannels ?? [],
    };
  }
  return out;
}
