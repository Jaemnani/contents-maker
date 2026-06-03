import type { GenResult } from "@/lib/types";

export default function VideoResult({ result }: { result: GenResult }) {
  if (result.videoUrl) {
    // OpenRouter video URLs need the API key -> play through our authenticated proxy.
    const src = `/api/download?url=${encodeURIComponent(result.videoUrl)}&inline=1`;
    return <video controls src={src} className="max-h-80 w-full rounded bg-black" />;
  }
  return (
    <div className="flex h-40 flex-col items-center justify-center rounded bg-gray-100 text-sm text-gray-400">
      {result.status === "error" ? (
        ""
      ) : (
        <>
          <span>영상 생성 중…</span>
          {typeof result.progress === "number" && <span>{Math.round(result.progress * 100)}%</span>}
          {result.jobId && <span className="mt-1 text-[10px]">job {result.jobId.slice(0, 8)}</span>}
        </>
      )}
    </div>
  );
}
