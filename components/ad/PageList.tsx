"use client";
// Page list: select / add / duplicate / delete / move up·down (no dnd dependency).
import { useState } from "react";
import type { AdPage, AdProject } from "@/lib/ad/schema";
import { newPageId, newAdPageForVisual, slotSource } from "@/lib/ad/schema";
import { pageFrames } from "@/remotion/ad/lib/timeline";
import { visualById } from "@/remotion/ad/templates/registry";
import { VISUAL_METAS, visualSourceSlots } from "@/remotion/ad/templates/meta";
import AddPageModal from "@/components/ad/AddPageModal";
import TemplateThumb from "@/components/ad/TemplateThumb";

export default function PageList({
  project,
  selectedId,
  onSelect,
  onPages,
}: {
  project: AdProject;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPages: (pages: AdPage[]) => void;
}) {
  const pages = project.pages;
  const fps = project.meta.fps || 30;
  const brand = project.product.brandColor;
  const [addOpen, setAddOpen] = useState(false);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= pages.length) return;
    const next = [...pages];
    [next[i], next[j]] = [next[j], next[i]];
    onPages(next);
  };
  const duplicate = (i: number) => {
    const copy: AdPage = { ...pages[i], id: newPageId(), voAudio: undefined };
    onPages([...pages.slice(0, i + 1), copy, ...pages.slice(i + 1)]);
    onSelect(copy.id);
  };
  const remove = (i: number) => {
    const next = pages.filter((_, x) => x !== i);
    onPages(next);
    if (pages[i].id === selectedId && next.length) onSelect(next[Math.min(i, next.length - 1)].id);
  };
  const addWithVisual = (visualId: string) => {
    const p = newAdPageForVisual(visualId, VISUAL_METAS[visualId]?.compatibleSourceTypes);
    onPages([...pages, p]);
    onSelect(p.id);
    setAddOpen(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {pages.map((p, i) => {
        const on = p.id === selectedId;
        const sec = (pageFrames(p, fps) / fps).toFixed(1);
        const missing = visualSourceSlots(p.visualTemplateId).filter((s) => slotSource(p, s.key).kind === "none").length;
        return (
          <div
            key={p.id}
            className={`rounded-lg border p-2.5 transition-all duration-200 ${on ? "border-empathy bg-empathy/5 ring-1 ring-empathy" : "border-border bg-surface hover:border-empathy"}`}
          >
            <button onClick={() => onSelect(p.id)} className="flex w-full gap-2 text-left">
              <TemplateThumb category="visual" id={p.visualTemplateId} brand={brand} className="w-9" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-white">{i + 1}</span>
                  <span className="truncate text-sm font-medium text-ink">{p.caption || "(자막 없음)"}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                  <span>{p.sourceType === "image" ? "🖼" : "🎬"}</span>
                  <span>{visualById(p.visualTemplateId).meta.name}</span>
                  <span>· {sec}s{p.voAudio ? " (VO)" : p.durationOverrideSec ? " (수동)" : ""}</span>
                  {missing > 0 && <span className="text-warning">· 소스 {missing}개 없음</span>}
                </div>
              </div>
            </button>
            <div className="mt-1.5 flex gap-1">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted hover:border-empathy disabled:opacity-30">↑</button>
              <button onClick={() => move(i, 1)} disabled={i === pages.length - 1} className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted hover:border-empathy disabled:opacity-30">↓</button>
              <button onClick={() => duplicate(i)} className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted hover:border-empathy">복제</button>
              <button onClick={() => remove(i)} className="ml-auto rounded border border-border px-1.5 py-0.5 text-[11px] text-danger hover:border-danger">삭제</button>
            </div>
          </div>
        );
      })}
      <button onClick={() => setAddOpen(true)} className="rounded-lg border border-dashed border-border py-2.5 text-sm text-muted transition-all duration-200 hover:border-empathy hover:text-ink">
        + 페이지 추가
      </button>
      <AddPageModal open={addOpen} brand={brand} onPick={addWithVisual} onClose={() => setAddOpen(false)} />
    </div>
  );
}
