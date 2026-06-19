"use client";
// Ad editor orchestrator: holds the AdProject, debounced save, page selection.
// Layout: page list | inspector | live Player preview.
import { useEffect, useMemo, useRef, useState } from "react";
import type { AdPage, AdProject } from "@/lib/ad/schema";
import { saveAdProject, composeAd, ttsAdPage } from "@/lib/client/ad";
import { useModels } from "@/hooks/useModels";
import type { SelectOption } from "@/components/ui/Select";
import PipelineBar from "@/components/ad/PipelineBar";
import PageList from "@/components/ad/PageList";
import PageInspector from "@/components/ad/PageInspector";
import PlayerPreview from "@/components/ad/PlayerPreview";
import BgmPanel from "@/components/ad/BgmPanel";
import EndcardPanel from "@/components/ad/EndcardPanel";
import ProductPanel from "@/components/ad/ProductPanel";
import AdRenderPanel from "@/components/ad/AdRenderPanel";

export default function AdEditor({ project: initial, onExit }: { project: AdProject; onExit: () => void }) {
  const { data } = useModels();
  const [project, setProject] = useState<AdProject>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial.pages[0]?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false); // long-running op (compose/tts/render) — locks heavy actions
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errMsg, setErrMsg] = useState("");
  const [ttsProgress, setTtsProgress] = useState<{ done: number; total: number } | null>(null);
  const [ttsBusyId, setTtsBusyId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false); // project-common settings (collapsed by default)

  const imageModels: SelectOption[] = useMemo(
    () => (data ? data.models.filter((m) => m.modality === "image").map((m) => ({ value: m.uid, label: m.label })) : []),
    [data]
  );

  // Debounced save — rapid edits (typing) don't fire a POST per keystroke.
  const projRef = useRef(project);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Undo/redo: snapshot stacks of whole-project states (immutable, so refs are safe).
  const undoRef = useRef<AdProject[]>([]);
  const redoRef = useRef<AdProject[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const syncHistoryFlags = () => {
    setCanUndo(undoRef.current.length > 0);
    setCanRedo(redoRef.current.length > 0);
  };
  /** Record the CURRENT state before a user edit replaces it. */
  function pushHistory() {
    undoRef.current.push(projRef.current);
    if (undoRef.current.length > 60) undoRef.current.shift();
    redoRef.current = [];
    syncHistoryFlags();
  }
  function undo() {
    if (!undoRef.current.length) return;
    redoRef.current.push(projRef.current);
    setBoth(undoRef.current.pop()!);
    scheduleSave();
    syncHistoryFlags();
  }
  function redo() {
    if (!redoRef.current.length) return;
    undoRef.current.push(projRef.current);
    setBoth(redoRef.current.pop()!);
    scheduleSave();
    syncHistoryFlags();
  }

  function setBoth(next: AdProject) {
    projRef.current = next;
    setProject(next);
  }
  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      saveAdProject(projRef.current)
        .then(() => setSaving(false))
        .catch((e) => {
          setSaving(false);
          setErrMsg(`저장 실패: ${(e as Error).message} — 다시 수정하면 재시도됩니다.`);
        });
    }, 400);
  }

  /** Flush any pending debounced save NOW — server ops must read the latest project. */
  async function flushSave() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      await saveAdProject(projRef.current);
    } finally {
      setSaving(false);
    }
  }
  /** Adopt a server-persisted project (no extra save). Server ops are undoable too. */
  function applyProject(p: AdProject) {
    pushHistory();
    setBoth(p);
  }
  function patchProject(patch: Partial<AdProject>) {
    pushHistory();
    setBoth({ ...projRef.current, ...patch });
    scheduleSave();
  }
  function patchPage(pageId: string, patch: Partial<AdPage>) {
    pushHistory();
    setBoth({
      ...projRef.current,
      pages: projRef.current.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)),
    });
    scheduleSave();
  }
  function setPages(pages: AdPage[]) {
    patchProject({ pages });
  }

  // Flush pending save on unmount.
  useEffect(
    () => () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveAdProject(projRef.current).catch(() => {});
      }
    },
    []
  );

  useEffect(() => {
    if (!busy) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [busy]);

  // Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z or Ctrl+Y = redo (skip while typing in a field).
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return; // let native text undo work
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.ctrlKey && k === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = project.pages.find((p) => p.id === selectedId) ?? null;

  async function runCompose() {
    setBusy(true);
    setErrMsg("");
    setWarnings([]);
    try {
      await flushSave(); // the LLM reads topic/product from disk
      const { project: next, warnings: w } = await composeAd(projRef.current.projectId);
      applyProject(next);
      setSelectedId(next.pages[0]?.id ?? null);
      setWarnings(w);
    } catch (e) {
      setErrMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runTts(pageId: string) {
    setBusy(true); // server read-modify-write — block other heavy ops meanwhile
    setTtsBusyId(pageId);
    setErrMsg("");
    try {
      await flushSave(); // TTS must narrate the text as currently typed
      applyProject(await ttsAdPage(projRef.current.projectId, pageId));
    } catch (e) {
      setErrMsg((e as Error).message);
    } finally {
      setTtsBusyId(null);
      setBusy(false);
    }
  }

  async function runTtsAll() {
    const ids = projRef.current.pages.filter((p) => p.vo.trim()).map((p) => p.id);
    if (!ids.length) return;
    setBusy(true);
    setErrMsg("");
    setTtsProgress({ done: 0, total: ids.length });
    try {
      await flushSave();
      for (let i = 0; i < ids.length; i++) {
        // re-resolve each target — pages may have been deleted/edited mid-batch
        const page = projRef.current.pages.find((p) => p.id === ids[i]);
        if (page && page.vo.trim()) {
          applyProject(await ttsAdPage(projRef.current.projectId, ids[i]));
        }
        setTtsProgress({ done: i + 1, total: ids.length });
      }
    } catch (e) {
      setErrMsg((e as Error).message);
    } finally {
      setBusy(false);
      setTtsProgress(null);
    }
  }

  return (
    <main className="w-full grow px-5 py-6">
      <header className="mb-5 flex items-center gap-3">
        <button
          onClick={() => flushSave().catch(() => {}).then(onExit)} // persist pending edits before the list refetches
          disabled={busy}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-muted transition-all duration-200 hover:border-empathy hover:text-ink disabled:opacity-40"
        >
          ← 목록
        </button>
        <div className="flex gap-1">
          <button onClick={undo} disabled={!canUndo} title="실행 취소 (⌘/Ctrl+Z)" className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-muted transition-all duration-200 hover:border-empathy hover:text-ink disabled:opacity-30">↶</button>
          <button onClick={redo} disabled={!canRedo} title="다시 실행 (⌘/Ctrl+Shift+Z)" className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-muted transition-all duration-200 hover:border-empathy hover:text-ink disabled:opacity-30">↷</button>
        </div>
        <h1 className="text-lg font-extrabold tracking-tight">광고 메이커</h1>
        <span className="text-xs text-muted">{project.projectId}</span>
        <input
          value={project.meta.topic}
          onChange={(e) => patchProject({ meta: { ...project.meta, topic: e.target.value } })}
          placeholder="주제"
          className="ml-3 w-64 rounded-md border border-border bg-surface px-3 py-1.5 text-base outline-none focus:border-primary"
        />
        <span className="ml-auto text-xs text-muted">{saving ? "저장 중…" : "저장됨"}</span>
      </header>

      <PipelineBar project={project} busy={busy} onCompose={runCompose} onTtsAll={runTtsAll} ttsProgress={ttsProgress} />

      {/* project-common settings — collapsible bar at the top, full width when open */}
      <section className="mb-3 rounded-lg border border-border bg-surface">
        <button onClick={() => setSettingsOpen((o) => !o)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left">
          <span className="text-sm font-bold text-ink">프로젝트 설정</span>
          <span className="text-xs text-muted">브랜드 · BGM · 엔드카드 — 영상 전체에 공통 적용</span>
          <span className="ml-auto text-xs text-muted">{settingsOpen ? "접기 ▲" : "펼치기 ▼"}</span>
        </button>
        {settingsOpen && (
          <div className="grid grid-cols-1 gap-5 border-t border-border p-4 md:grid-cols-2 xl:grid-cols-3">
            <ProductPanel product={project.product} onProduct={(p) => patchProject({ product: p })} />
            <BgmPanel project={project} onAudio={(audio) => patchProject({ audio })} onProject={applyProject} onFlush={flushSave} />
            <EndcardPanel project={project} onEndcard={(endcard) => patchProject({ endcard })} onProduct={(p) => patchProject({ product: p })} />
          </div>
        )}
      </section>

      {/* AI generation inputs: value-props (script) + suggested base image prompt */}
      <section className="mb-3 rounded-md border border-empathy/30 bg-empathy/5 p-3">
        <div className="mb-2 text-xs font-semibold text-empathy">✨ AI 대본 생성 입력</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 text-[11px] text-muted">강조점 / 가치 제안 <span>(줄바꿈으로 구분 · 대본에 반영, 화면엔 직접 안 나옴)</span></div>
            <textarea
              value={project.product.valueProps.join("\n")}
              onChange={(e) => patchProject({ product: { ...project.product, valueProps: e.target.value.split("\n").filter((s) => s.trim()) } })}
              placeholder={"예: 클릭 한 번으로 영상 완성\n무료로 시작\n워터마크 없음"}
              className="h-16 w-full resize-y rounded border border-border bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
            />
          </div>
          {project.meta.seedPrompt != null && (
            <div>
              <div className="mb-1 text-[11px] text-muted">추천 본론 프롬프트 <span>(이미지 생성용 · 페이지 ‘AI 생성’에서 불러와 사용)</span></div>
              <textarea
                value={project.meta.seedPrompt}
                onChange={(e) => patchProject({ meta: { ...project.meta, seedPrompt: e.target.value } })}
                className="h-16 w-full resize-y rounded border border-border bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>
          )}
        </div>
      </section>

      {errMsg && <p className="mb-3 rounded-md bg-danger/10 px-3 py-2 text-xs text-danger">{errMsg}</p>}
      {warnings.length > 0 && (
        <div className="mb-3 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
          {warnings.map((w, i) => (
            <div key={i}>⚠️ {w}</div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[260px_minmax(0,1fr)_360px] gap-5">
        <aside>
          <h2 className="mb-2 text-sm font-bold">페이지</h2>
          <PageList project={project} selectedId={selectedId} onSelect={setSelectedId} onPages={setPages} />
        </aside>

        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-bold">페이지 편집</h2>
          {selected ? (
            <PageInspector
              key={selected.id} // reset per-page local state (chooser tab, prompt draft)
              project={project}
              page={selected}
              imageModels={imageModels}
              onPatch={(patch) => patchPage(selected.id, patch)}
              onProject={applyProject}
              onProductName={(name) => patchProject({ product: { ...projRef.current.product, name } })}
              onTts={runTts}
              ttsBusy={ttsBusyId === selected.id || busy}
              onFlush={flushSave}
            />
          ) : (
            <p className="text-sm text-muted">왼쪽에서 페이지를 선택하세요.</p>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <div>
            <h2 className="mb-2 text-sm font-bold">미리보기</h2>
            <PlayerPreview project={project} />
          </div>
          <AdRenderPanel project={project} busy={busy} onBusy={setBusy} onProject={applyProject} onFlush={flushSave} />
        </aside>
      </div>

    </main>
  );
}
