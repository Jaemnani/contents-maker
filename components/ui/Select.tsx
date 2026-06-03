"use client";
// DESIGN.md: native <select> is broken under Tailwind v4 — custom dropdown using the
// backdrop-div outside-click pattern (iOS Safari compatible).
import { useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export default function Select({
  value,
  options,
  onChange,
  placeholder = "선택",
  disabled,
  className = "",
}: {
  value: string | undefined;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.value === value);
  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-left text-sm transition-all duration-200 hover:border-empathy disabled:opacity-40"
      >
        <span className={cur ? "text-ink" : "text-muted"}>{cur?.label ?? placeholder}</span>
        <span className="text-muted">▾</span>
      </button>
      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-md">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-surface-muted ${
                  o.value === value ? "font-semibold text-primary" : "text-ink"
                }`}
              >
                {o.label}
              </button>
            ))}
            {!options.length && <div className="px-3 py-2 text-sm text-muted">항목 없음</div>}
          </div>
        </>
      )}
    </div>
  );
}
