"use client";
import type { GenResult, Modality } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import TextResult from "@/components/TextResult";
import ImageResult from "@/components/ImageResult";
import VideoResult from "@/components/VideoResult";
import { formatUSD } from "@/lib/pricing";
import { downloadResult } from "@/lib/client/download";

export default function ResultCard({
  result,
  contentType,
  label,
  provider,
  onRetry,
  busy,
}: {
  result: GenResult;
  contentType: Modality;
  label: string;
  provider: string;
  onRetry?: (model: string) => void;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-800">{label}</div>
          <div className="truncate text-xs text-gray-400">{provider} · {result.model}</div>
        </div>
        <StatusBadge status={result.status} />
      </div>

      <div className="flex-1">
        {result.status === "error" ? (
          <div className="space-y-2">
            <div className="rounded bg-red-50 p-2 text-xs text-red-600">{result.error}</div>
            {onRetry && (
              <button
                onClick={() => onRetry(result.model)}
                disabled={busy}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                ↻ 재시도
              </button>
            )}
          </div>
        ) : contentType === "text" ? (
          <TextResult result={result} />
        ) : contentType === "image" ? (
          <ImageResult result={result} />
        ) : (
          <VideoResult result={result} />
        )}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-1.5 text-xs text-gray-400">
        <span>{result.ms != null ? `${(result.ms / 1000).toFixed(1)}s` : ""}</span>
        <div className="flex items-center gap-2">
          {result.status === "done" && (
            <button onClick={() => downloadResult(result, contentType)} className="text-primary hover:underline">
              다운로드
            </button>
          )}
          <span>{result.actualCost != null ? `실비 ${formatUSD(result.actualCost)}` : ""}</span>
        </div>
      </div>
    </div>
  );
}
