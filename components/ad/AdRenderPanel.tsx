"use client";
// Render panel: start a local render (SSE progress), preview/download/delete history.
import { useState } from "react";
import type { AdProject } from "@/lib/ad/schema";
import { slotSource } from "@/lib/ad/schema";
import { streamAdRender, getAdProject, deleteAdRender } from "@/lib/client/ad";
import { visualSourceSlots } from "@/remotion/ad/templates/meta";
import { fileUrl } from "@/lib/client/wizard";

const PHASE_LABEL: Record<string, string> = {
  browser: "브라우저 준비",
  bundle: "번들링",
  render: "렌더링",
  done: "완료",
};

/** Human-friendly download filename: "<주제 또는 제품명>_YYYYMMDD.mp4". */
function downloadName(project: AdProject, createdAt: string): string {
  const base =
    (project.meta.topic || project.product.name || "ad")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 40) || "ad";
  const d = new Date(createdAt);
  const stamp = Number.isNaN(d.getTime())
    ? ""
    : `_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${base}${stamp}.mp4`;
}

export default function AdRenderPanel({
  project,
  busy,
  onBusy,
  onProject,
  onFlush,
}: {
  project: AdProject;
  busy: boolean;
  onBusy: (b: boolean) => void;
  onProject: (p: AdProject) => void;
  onFlush?: () => Promise<void>;
}) {
  const [phase, setPhase] = useState<string | null>(null);
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const pagesReady = project.pages.length > 0 || project.endcard.enabled;
  const missingSources = project.pages.filter((p) =>
    visualSourceSlots(p.visualTemplateId).some((s) => slotSource(p, s.key).kind === "none")
  ).length;

  async function del(path: string) {
    if (!window.confirm("이 렌더 영상을 삭제할까요? 파일도 함께 삭제됩니다.")) return;
    setDeleting(path);
    setErr("");
    try {
      onProject(await deleteAdRender(project.projectId, path));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setDeleting(null);
    }
  }

  async function run() {
    onBusy(true);
    setErr("");
    setPhase("browser");
    setPct(0);
    try {
      await onFlush?.(); // render must read the latest saved project
      await streamAdRender(project.projectId, (e) => {
        if (e.type === "progress") {
          setPhase(e.phase);
          if (typeof e.pct === "number") setPct(e.pct);
        } else if (e.type === "error") {
          setErr(e.message);
        }
      });
      onProject(await getAdProject(project.projectId)); // pick up latestRender/history
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      onBusy(false);
      setPhase(null);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4" id="ad-render-panel">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-sm font-bold">렌더 <span className="text-xs font-normal text-muted">(로컬 · 오디오 포함 · ko)</span></h2>
        <button
          onClick={run}
          disabled={busy || !pagesReady}
          className="ml-auto rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-primary-dark active:scale-[0.98] disabled:opacity-40"
        >
          {phase ? "렌더 중…" : "MP4 렌더"}
        </button>
      </div>

      {missingSources > 0 && (
        <p className="mb-2 text-xs text-warning">⚠️ 소스 없는 페이지 {missingSources}개 — 플레이스홀더로 렌더됩니다.</p>
      )}

      {phase && (
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>{PHASE_LABEL[phase] ?? phase}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {err && <p className="mb-2 text-xs text-danger">{err}</p>}

      {(project.renderHistory ?? []).length > 0 && (
        <div className="flex flex-col gap-2">
          {(project.renderHistory ?? []).map((r, i) => (
            <div key={r.path} className={`relative flex items-center gap-3 rounded-md border p-2 ${i === 0 ? "border-empathy bg-empathy/5" : "border-border"}`}>
              <button
                onClick={() => del(r.path)}
                disabled={deleting === r.path}
                title="이 렌더 삭제"
                className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink/10 text-xs text-muted transition-colors hover:bg-danger hover:text-white disabled:opacity-40"
              >
                {deleting === r.path ? "…" : "✕"}
              </button>
              <video src={fileUrl(r.path)} controls preload="metadata" className="h-28 w-16 rounded bg-ink object-cover" />
              <div className="min-w-0 flex-1 pr-5">
                {i === 0 && <span className="mb-0.5 inline-block rounded bg-empathy px-1.5 py-0.5 text-[10px] font-bold text-white">최신</span>}
                <div className="truncate text-xs font-medium text-ink">{downloadName(project, r.createdAt)}</div>
                <div className="text-[11px] text-muted">{new Date(r.createdAt).toLocaleString()}</div>
                <a href={fileUrl(r.path)} download={downloadName(project, r.createdAt)} className="mt-1 inline-block rounded border border-border px-2 py-0.5 text-[11px] text-ink transition-all duration-200 hover:border-empathy">
                  ⬇ 다운로드
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
