"use client";
import type { ImageParams, Modality, TextParams, VideoParams } from "@/lib/types";
import { IMAGE_ASPECTS, IMAGE_RESOLUTIONS, TEXT_VARIANTS, VIDEO_DEFAULTS } from "@/lib/channels";

export default function ChannelParams({
  modality,
  text,
  onText,
  image,
  onImage,
  video,
  onVideo,
}: {
  modality: Modality;
  text: TextParams;
  onText: (p: TextParams) => void;
  image: ImageParams;
  onImage: (p: ImageParams) => void;
  video: VideoParams;
  onVideo: (p: VideoParams) => void;
}) {
  if (modality === "text") {
    return (
      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">출력</span>
          <div className="inline-flex rounded border border-gray-200 p-0.5">
            <button
              onClick={() => onText({ ...text, mode: "marketing" })}
              className={`rounded px-2 py-0.5 text-xs ${text.mode === "marketing" ? "bg-primary text-white" : "text-gray-600"}`}
            >
              마케팅 카피(5변형)
            </button>
            <button
              onClick={() => onText({ ...text, mode: "raw" })}
              className={`rounded px-2 py-0.5 text-xs ${text.mode === "raw" ? "bg-primary text-white" : "text-gray-600"}`}
            >
              원본 답변
            </button>
          </div>
        </div>
        <div className="text-xs text-gray-400">
          {text.mode === "marketing"
            ? `채널용 5단 변형: ${TEXT_VARIANTS.map((v) => v.id).join(" / ")}`
            : "프롬프트에 대한 각 AI의 직접 답변을 비교"}
        </div>
        <label className="flex items-center gap-2">
          <span className="text-xs text-gray-500">max tokens</span>
          <input
            type="number"
            min={500}
            max={20000}
            step={500}
            value={text.maxTokens}
            onChange={(e) => onText({ ...text, maxTokens: Number(e.target.value) || 5000 })}
            className="w-24 rounded border border-gray-200 px-2 py-0.5"
          />
        </label>
      </div>
    );
  }

  if (modality === "image") {
    const toggle = (id: string) =>
      onImage({
        ...image,
        aspects: image.aspects.includes(id)
          ? image.aspects.filter((a) => a !== id)
          : [...image.aspects, id],
      });
    return (
      <div className="space-y-2 text-sm text-gray-600">
        <PromptModeToggle enhance={image.enhance} onChange={(en) => onImage({ ...image, enhance: en })} />
        <div>
          <div className="mb-1 text-xs text-gray-500">비율 (모델당 선택 비율 수만큼 생성, image_config로 적용)</div>
          <div className="flex gap-3">
            {IMAGE_ASPECTS.map((a) => (
              <label key={a.id} className="flex items-center gap-1">
                <input type="checkbox" checked={image.aspects.includes(a.id)} onChange={() => toggle(a.id)} />
                <span>{a.label}</span>
                <span className="text-xs text-gray-400">{a.note}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs text-gray-500">해상도</div>
          <div className="inline-flex rounded border border-gray-200 p-0.5">
            {IMAGE_RESOLUTIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => onImage({ ...image, resolution: r.id })}
                title={r.note}
                className={`rounded px-2 py-0.5 text-xs ${image.resolution === r.id ? "bg-primary text-white" : "text-gray-600"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {image.resolution === "2k"
              ? "긴 변 ~2048(모델별 상한까지: Flux·Seedream 2048, Qwen·Z-Image 1536) · Nano Banana·OpenRouter는 비율만 지원해 ~1MP 유지"
              : "~1MP. 빠르고 저렴 · 모든 모델 공통"}
          </p>
        </div>
      </div>
    );
  }

  // video
  const warn = video.duration >= VIDEO_DEFAULTS.warnDurationAtOrAbove;
  return (
    <div className="space-y-2 text-sm text-gray-600">
      <PromptModeToggle enhance={video.enhance} onChange={(en) => onVideo({ ...video, enhance: en })} />
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">비율</span>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{video.aspectRatio} 고정</span>
        <span className="ml-2 text-xs text-gray-500">해상도</span>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{video.resolution}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">길이</span>
        {VIDEO_DEFAULTS.durationOptions.map((d) => (
          <button
            key={d}
            onClick={() => onVideo({ ...video, duration: d })}
            className={`rounded px-2 py-0.5 text-xs ${
              video.duration === d ? "bg-primary text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {d}s
          </button>
        ))}
        {warn && <span className="text-xs text-red-500">⚠ 길수록 비용·시간 큼</span>}
      </div>
      <p className="text-xs text-gray-400">
        {video.enhance
          ? "개선본: 첫 3초 훅·언어 지시가 프롬프트에 자동 포함됩니다. (모델별 지원 길이로 클램프)"
          : "원본: 입력한 프롬프트만 전송합니다. (모델별 지원 길이로 클램프)"}
      </p>
    </div>
  );
}

function PromptModeToggle({ enhance, onChange }: { enhance: boolean; onChange: (en: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">프롬프트</span>
      <div className="inline-flex rounded border border-gray-200 p-0.5">
        <button
          onClick={() => onChange(false)}
          className={`rounded px-2 py-0.5 text-xs ${!enhance ? "bg-primary text-white" : "text-gray-600"}`}
        >
          원본
        </button>
        <button
          onClick={() => onChange(true)}
          className={`rounded px-2 py-0.5 text-xs ${enhance ? "bg-primary text-white" : "text-gray-600"}`}
        >
          개선본
        </button>
      </div>
    </div>
  );
}
