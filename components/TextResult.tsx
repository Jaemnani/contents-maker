"use client";
import { useState } from "react";
import type { GenResult } from "@/lib/types";
import { TEXT_VARIANTS } from "@/lib/channels";

export default function TextResult({ result }: { result: GenResult }) {
  const [active, setActive] = useState<string>(TEXT_VARIANTS[0].id);

  // While streaming (or if parsing yielded nothing), show raw text.
  const variants = result.variants ?? {};
  const hasVariants = Object.keys(variants).length > 0 && result.status === "done";

  if (!hasVariants) {
    return (
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-sm text-gray-700">
        {result.raw || (result.status === "error" ? "" : "…")}
      </pre>
    );
  }

  const present = TEXT_VARIANTS.filter((v) => variants[v.id]);
  const current = variants[active] ?? variants[present[0]?.id];

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1">
        {present.map((v) => (
          <button
            key={v.id}
            onClick={() => setActive(v.id)}
            className={`rounded px-2 py-0.5 text-xs ${
              active === v.id ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      {current && (
        <div>
          <div className="mb-1 text-xs text-gray-400">
            {current.chars}자 · {current.targetChannels.join(", ")}
          </div>
          <p className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-sm text-gray-800">
            {current.text}
          </p>
        </div>
      )}
    </div>
  );
}
