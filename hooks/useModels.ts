"use client";
import { useEffect, useState } from "react";
import type { ModelEntry, Modality, Tier } from "@/lib/types";

export interface ModelsData {
  models: ModelEntry[];
  byId: Record<string, ModelEntry>;
  tiers: Tier[];
  tierLabels: Record<Tier, string>;
  cheapestPresets: Record<Modality, string[]>;
  generatedAt: string;
  pricingSource: string;
}

export function useModels() {
  const [data, setData] = useState<ModelsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const models: ModelEntry[] = d.models ?? [];
        setData({
          models,
          byId: Object.fromEntries(models.map((m) => [m.uid, m])),
          tiers: d.tiers ?? [],
          tierLabels: d.tierLabels ?? {},
          cheapestPresets: d.cheapestPresets ?? { text: [], image: [], video: [] },
          generatedAt: d.generatedAt ?? "",
          pricingSource: d.pricingSource ?? "static",
        });
      })
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, []);

  return { data, error };
}
