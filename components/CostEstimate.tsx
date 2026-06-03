"use client";
import type { SelectionEstimate } from "@/lib/client/estimate";
import { formatUSD } from "@/lib/pricing";

export default function CostEstimate({ est, modelCount }: { est: SelectionEstimate; modelCount: number }) {
  const high = est.max >= 2; // warn threshold (USD per run)
  const label = est.exact
    ? formatUSD(est.min)
    : est.min === est.max
      ? formatUSD(est.min)
      : `${formatUSD(est.min)} ~ ${formatUSD(est.max)}`;

  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
        high ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"
      }`}
    >
      <span className="text-gray-600">
        예상 비용 {est.exact ? "" : "(랜덤 범위)"} · 모델 {modelCount}개
      </span>
      <span className={`font-semibold ${high ? "text-red-600" : "text-gray-800"}`}>
        {label}
        {est.unknownCount > 0 && (
          <span className="ml-1 text-xs font-normal text-gray-400">+{est.unknownCount} 단가미상</span>
        )}
      </span>
    </div>
  );
}
