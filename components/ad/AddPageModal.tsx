"use client";
// Page-add flow: pick the VISUAL (page type) FIRST — the page is only created once a
// layout is chosen. Shows schematic previews so the choice is informed.
import { VISUAL_METAS } from "@/remotion/ad/templates/meta";
import TemplatePicker from "@/components/ad/TemplatePicker";

export default function AddPageModal({
  open,
  brand,
  onPick,
  onClose,
}: {
  open: boolean;
  brand?: string;
  onPick: (visualId: string) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  const options = Object.values(VISUAL_METAS);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-ink">어떤 페이지를 만들까요?</h3>
        <p className="mt-1 mb-3 text-xs text-muted">레이아웃(비주얼)을 먼저 고르세요. 모션·전환·소스는 추가한 뒤 편집할 수 있어요.</p>
        <div className="max-h-[64vh] overflow-y-auto pr-1">
          <TemplatePicker category="visual" options={options} value="" onChange={onPick} brand={brand} cols={2} />
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:border-empathy">취소</button>
        </div>
      </div>
    </div>
  );
}
