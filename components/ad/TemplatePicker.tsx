"use client";
// Card picker: each option shows a schematic thumb so the user sees what a template
// looks like instead of decoding a transliterated name.
//  - default: thumb + name + hint (roomy).
//  - compact: thumbs-only row (image-first); name/hint on hover + a "current" label below.
import type { TemplateMeta } from "@/remotion/ad/types";
import TemplateThumb from "@/components/ad/TemplateThumb";

export default function TemplatePicker({
  category,
  options,
  value,
  onChange,
  brand = "#ff5a1f",
  cols = 2,
  compact = false,
}: {
  category: "visual" | "motion" | "transition" | "endcard";
  options: TemplateMeta[];
  value: string;
  onChange: (id: string) => void;
  brand?: string;
  cols?: number;
  compact?: boolean;
}) {
  if (compact) {
    const sel = options.find((o) => o.id === value);
    return (
      <div>
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => {
            const on = o.id === value;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onChange(o.id)}
                title={o.hint ? `${o.name} — ${o.hint}` : o.name}
                className={`rounded-md border p-0.5 transition-all duration-200 ${
                  on ? "border-empathy ring-1 ring-empathy" : "border-border hover:border-empathy"
                }`}
              >
                <TemplateThumb category={category} id={o.id} brand={brand} className="w-12" />
              </button>
            );
          })}
        </div>
        {sel && (
          <div className="mt-1 text-[11px] text-muted">
            <b className="text-ink">{sel.name}</b>
            {sel.hint ? ` · ${sel.hint}` : ""}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            title={o.hint}
            className={`flex gap-2 rounded-lg border p-2 text-left transition-all duration-200 ${
              on ? "border-empathy bg-empathy/5 ring-1 ring-empathy" : "border-border hover:border-empathy"
            }`}
          >
            <TemplateThumb category={category} id={o.id} brand={brand} className="w-9" />
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-ink">{o.name}</div>
              {o.hint && <div className="mt-0.5 text-[10px] leading-snug text-muted">{o.hint}</div>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
