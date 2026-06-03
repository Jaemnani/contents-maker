"use client";
import type { Language } from "@/lib/types";
import { LANGUAGE_LABELS } from "@/lib/channels";

const LANGS: Language[] = ["ko", "ja"];

export default function LanguageTabs({
  value,
  onChange,
  disabled,
}: {
  value: Language;
  onChange: (l: Language) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`inline-flex rounded-lg border border-gray-200 p-0.5 ${disabled ? "opacity-50" : ""}`}>
      {LANGS.map((l) => (
        <button
          key={l}
          disabled={disabled}
          onClick={() => onChange(l)}
          className={`rounded-md px-3 py-1 text-sm font-medium disabled:cursor-not-allowed ${
            value === l ? "bg-gray-800 text-white" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {LANGUAGE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
