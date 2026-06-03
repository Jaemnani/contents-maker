import type { GenResult } from "@/lib/types";

export default function ImageResult({ result }: { result: GenResult }) {
  const images = result.images ?? [];
  if (!images.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded bg-gray-100 text-sm text-gray-400">
        {result.status === "error" ? "" : "이미지 생성 중…"}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {images.map((img, i) => (
        <figure key={i} className="overflow-hidden rounded border border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.dataUrl} alt={`${result.model} ${img.aspect}`} className="w-full" />
          <figcaption className="bg-gray-50 px-1 py-0.5 text-center text-xs text-gray-400">
            {img.aspect}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
