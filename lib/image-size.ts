// Shared helpers for the image 1K/2K resolution toggle.
// Only fal `image_size` models and WaveSpeed models accept explicit pixel sizes;
// aspect-only providers (fal Nano Banana, OpenRouter) ignore resolution.
import type { ImageResolution } from "@/lib/types";

export type Dims = { width: number; height: number };

// Clamp the longer edge to a model's max (preserving aspect, rounded to /16). No-op without a max.
export function clampDims(d: Dims, maxDim?: number): Dims {
  if (!maxDim) return d;
  const m = Math.max(d.width, d.height);
  if (m <= maxDim) return d;
  const s = maxDim / m, r = (n: number) => Math.max(16, Math.round((n * s) / 16) * 16);
  return { width: r(d.width), height: r(d.height) };
}

export function pickDims(
  table1k: Record<string, Dims>,
  table2k: Record<string, Dims>,
  aspect: string,
  resolution: ImageResolution,
  maxDim?: number,
): Dims {
  const table = resolution === "2k" ? table2k : table1k;
  return clampDims(table[aspect] ?? table["1:1"], maxDim);
}
