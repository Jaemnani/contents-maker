// Model registry — generated from data/models.json (produced by scripts/fetch-inventory.py).
// Tiers are a price-band proxy (no objective benchmark in the API); adjustable in the inventory.
import raw from "@/data/models.json";
import type { ModelEntry, Modality, Tier } from "@/lib/types";
import { falModelEntries } from "@/lib/fal/models";
import { wsModelEntries } from "@/lib/ws/models";

function prettify(id: string): string {
  const seg = id.split("/")[1] ?? id;
  const free = seg.endsWith(":free");
  const base = free ? seg.slice(0, -5) : seg;
  const label = base
    .split("-")
    .map((w) => (/^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
  return free ? `${label} (free)` : label;
}

// OpenRouter pricing values arrive as strings in the JSON -> convert to numbers.
const toNum = (x: unknown): number | null =>
  x === null || x === undefined || x === "" ? null : Number(x);

type Price = string | number | null;
interface RawText {
  id: string; provider: string; tier: Tier;
  pricing: { prompt?: Price; completion?: Price };
}
interface RawImage {
  id: string; provider: string; tier: Tier; jaTextQuality?: "good" | "unknown";
  imageUnitUsd?: number | null;
  pricing: { image?: Price; prompt?: Price; completion?: Price };
}
interface RawVideo {
  id: string; provider: string; tier: Tier;
  resolutions?: string[] | null; aspectRatios?: string[] | null; durations?: number[] | null;
  sizes?: string[] | null; generateAudio?: boolean | null; tokenBased?: boolean;
  pricingSkus?: Record<string, string> | null;
}

const textModels: Omit<ModelEntry, "uid">[] = (raw.text as unknown as RawText[]).map((m) => ({
  id: m.id,
  label: prettify(m.id),
  provider: m.provider,
  serving: "openrouter",
  modality: "text",
  inputModalities: ["text"],
  outputModalities: ["text"],
  tier: m.tier,
  supportsStreaming: true,
  pricing: { prompt: toNum(m.pricing.prompt), completion: toNum(m.pricing.completion) },
}));

const imageModels: Omit<ModelEntry, "uid">[] = (raw.image as unknown as RawImage[]).map((m) => ({
  id: m.id,
  label: prettify(m.id),
  provider: m.provider,
  serving: "openrouter",
  modality: "image",
  inputModalities: ["text"],
  outputModalities: ["image", "text"],
  tier: m.tier,
  jaTextQuality: m.jaTextQuality ?? "unknown",
  pricing: {
    image: toNum(m.pricing.image),
    imageUnitUsd: m.imageUnitUsd ?? null,
    prompt: toNum(m.pricing.prompt),
    completion: toNum(m.pricing.completion),
  },
}));

const videoModels: Omit<ModelEntry, "uid">[] = (raw.video as unknown as RawVideo[]).map((m) => ({
  id: m.id,
  label: prettify(m.id),
  provider: m.provider,
  serving: "openrouter",
  modality: "video",
  inputModalities: ["text"],
  outputModalities: ["video"],
  tier: m.tier,
  jaTextQuality: "unknown",
  video: {
    resolutions: m.resolutions ?? undefined,
    aspectRatios: m.aspectRatios ?? undefined,
    durations: m.durations ?? undefined,
    sizes: m.sizes ?? undefined,
    generateAudio: m.generateAudio ?? undefined,
    tokenBased: m.tokenBased,
  },
  pricing: { videoSkus: m.pricingSkus ?? undefined },
}));

// Assign a unique registry key per entry: uid = `${serving}:${id}` (raw id can collide
// across providers, e.g. WaveSpeed reuses `anthropic/claude-sonnet-4.6`).
const withUid = (e: Omit<ModelEntry, "uid">): ModelEntry => ({ ...e, uid: `${e.serving}:${e.id}` });

export const MODELS: ModelEntry[] = [
  ...textModels, ...imageModels, ...videoModels, ...falModelEntries(), ...wsModelEntries(),
].map(withUid);

export const MODELS_BY_ID: Record<string, ModelEntry> = Object.fromEntries(
  MODELS.map((m) => [m.uid, m])
);

export const modelsByModality = (m: Modality): ModelEntry[] =>
  MODELS.filter((x) => x.modality === m);

export const modelsByTier = (m: Modality, tier: Tier): ModelEntry[] =>
  MODELS.filter((x) => x.modality === m && x.tier === tier);

export const TIERS: Tier[] = (raw.tiers as Tier[]) ?? ["premium", "standard", "budget", "free"];
export const TIER_LABELS: Record<Tier, string> =
  (raw.tierLabels as Record<Tier, string>) ?? {
    premium: "프리미엄", standard: "표준", budget: "저가", free: "무료",
  };

// presets in data/models.json are raw OpenRouter ids -> map to uids
const toOrUid = (ids: unknown): string[] => ((ids as string[]) ?? []).map((id) => `openrouter:${id}`);
export const CHEAPEST_PRESETS: Record<Modality, string[]> = {
  text: toOrUid(raw.cheapestPresets?.text),
  image: toOrUid(raw.cheapestPresets?.image),
  video: toOrUid(raw.cheapestPresets?.video),
};

export const INVENTORY_GENERATED_AT: string = (raw as { generatedAt?: string }).generatedAt ?? "";
