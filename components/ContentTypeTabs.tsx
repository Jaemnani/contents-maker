"use client";
import type { Modality } from "@/lib/types";

const TYPES: { id: Modality; label: string }[] = [
  { id: "text", label: "텍스트" },
  { id: "image", label: "이미지" },
  { id: "video", label: "영상" },
];

export default function ContentTypeTabs({
  value,
  onChange,
  disabled,
}: {
  value: Modality;
  onChange: (m: Modality) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`inline-flex rounded-lg border border-gray-200 p-0.5 ${disabled ? "opacity-50" : ""}`}>
      {TYPES.map((t) => (
        <button
          key={t.id}
          disabled={disabled}
          onClick={() => onChange(t.id)}
          className={`rounded-md px-4 py-1 text-sm font-medium disabled:cursor-not-allowed ${
            value === t.id ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
