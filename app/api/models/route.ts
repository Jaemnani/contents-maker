// GET /api/models — registry + tiers + presets. Optionally refreshes pricing from live API.
import { NextResponse } from "next/server";
import {
  MODELS, TIERS, TIER_LABELS, CHEAPEST_PRESETS, INVENTORY_GENERATED_AT,
} from "@/lib/models";
import { orGet } from "@/lib/openrouter/client";
import type { ModelEntry } from "@/lib/types";

export const runtime = "nodejs";

interface LiveModel { id: string; pricing?: { prompt?: string; completion?: string; image?: string } }

async function hydratePricing(models: ModelEntry[]): Promise<{ models: ModelEntry[]; source: string }> {
  try {
    const live = await orGet<{ data: LiveModel[] }>("/models");
    const byId = new Map(live.data.map((m) => [m.id, m.pricing]));
    const merged = models.map((m) => {
      const lp = byId.get(m.id);
      if (!lp) return m;
      return {
        ...m,
        pricing: {
          ...m.pricing,
          prompt: lp.prompt != null ? Number(lp.prompt) : m.pricing?.prompt,
          completion: lp.completion != null ? Number(lp.completion) : m.pricing?.completion,
          image: lp.image != null ? Number(lp.image) : m.pricing?.image,
        },
      };
    });
    return { models: merged, source: "live" };
  } catch {
    return { models, source: "static" };
  }
}

export async function GET() {
  const { models, source } = await hydratePricing(MODELS);
  return NextResponse.json({
    models,
    tiers: TIERS,
    tierLabels: TIER_LABELS,
    cheapestPresets: CHEAPEST_PRESETS,
    generatedAt: INVENTORY_GENERATED_AT,
    pricingSource: source,
  });
}
