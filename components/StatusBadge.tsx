import type { ResultStatus } from "@/lib/types";

const STYLES: Record<ResultStatus, { label: string; cls: string }> = {
  idle: { label: "대기", cls: "bg-gray-200 text-gray-600" },
  loading: { label: "요청 중", cls: "bg-blue-100 text-blue-700" },
  streaming: { label: "생성 중", cls: "bg-blue-100 text-blue-700 animate-pulse" },
  processing: { label: "처리 중", cls: "bg-amber-100 text-amber-700 animate-pulse" },
  done: { label: "완료", cls: "bg-green-100 text-green-700" },
  error: { label: "오류", cls: "bg-red-100 text-red-700" },
};

export default function StatusBadge({ status }: { status: ResultStatus }) {
  const s = STYLES[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}
