"use client";
// One-click style themes: a thin chip strip. Clicking applies the theme to EVERY page's
// style fields in one undoable step (handled by AdEditor via themePatch + patchProject).
import { AD_THEMES, type AdTheme } from "@/lib/ad/themes";

export default function ThemeBar({ onApply, disabled }: { onApply: (t: AdTheme) => void; disabled?: boolean }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
      <span className="text-xs font-bold text-ink">🎨 테마</span>
      {AD_THEMES.map((t) => (
        <button
          key={t.id}
          onClick={() => onApply(t)}
          disabled={disabled}
          title={t.hint}
          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm transition-all duration-200 hover:border-empathy hover:-translate-y-px disabled:opacity-40"
          style={{ fontFamily: t.chipFont }}
        >
          <span className="h-3 w-3 rounded-full" style={{ background: t.swatch }} />
          {t.name}
        </button>
      ))}
      <span className="ml-auto text-[10px] text-muted">전체 페이지 스타일에 적용 · ⌘Z로 취소</span>
    </div>
  );
}
