"use client";
// Compact font / size / effect / color controls for an overlay text field.
import type { TextStyle, FontKey, TextEffect } from "@/lib/composition-types";
import { FONT_LABELS, EFFECT_LABELS } from "@/lib/composition-types";
import Select, { type SelectOption } from "@/components/ui/Select";

const FONT_OPTS: SelectOption[] = (Object.keys(FONT_LABELS) as FontKey[]).map((k) => ({ value: k, label: FONT_LABELS[k] }));
const EFFECT_OPTS: SelectOption[] = (Object.keys(EFFECT_LABELS) as TextEffect[]).map((k) => ({ value: k, label: EFFECT_LABELS[k] }));

export default function TextStyleControls({
  value,
  defaultSize,
  onChange,
}: {
  value?: TextStyle;
  defaultSize: number;
  onChange: (s: TextStyle) => void;
}) {
  const v = value ?? {};
  const set = (patch: Partial<TextStyle>) => onChange({ ...v, ...patch });
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <div className="w-36">
        <Select value={v.font ?? "black"} options={FONT_OPTS} onChange={(x) => set({ font: x as FontKey })} />
      </div>
      <input
        type="number"
        min={16}
        max={220}
        value={v.size ?? defaultSize}
        onChange={(e) => set({ size: Number(e.target.value) || defaultSize })}
        title="크기(px)"
        className="w-20 rounded-md border border-border bg-surface px-2 py-1.5 text-base outline-none focus:border-primary"
      />
      <div className="w-24">
        <Select value={v.effect ?? "shadow"} options={EFFECT_OPTS} onChange={(x) => set({ effect: x as TextEffect })} />
      </div>
      <input
        type="color"
        value={v.color ?? "#ffffff"}
        onChange={(e) => set({ color: e.target.value })}
        title="색상"
        className="h-9 w-10 cursor-pointer rounded border border-border bg-surface"
      />
    </div>
  );
}
