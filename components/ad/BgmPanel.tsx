"use client";
// BGM panel: tab "라이브러리/업로드" + tab "생성" (fal text-to-music). Volume + VO-ducking.
import { useState } from "react";
import type { AdProject, AdAudio } from "@/lib/ad/schema";
import { DEFAULT_BASE_VOLUME, DEFAULT_DUCK_VOLUME } from "@/lib/ad/schema";
import { uploadFile, fileUrl } from "@/lib/client/wizard";
import { generateAdBgm } from "@/lib/client/ad";

// public/bgm/ manifest — drop more files in and list them here.
const LIBRARY = [{ file: "track.mp3", label: "기본 트랙" }];

export default function BgmPanel({
  project,
  onAudio,
  onProject,
  onFlush,
  onSnap,
}: {
  project: AdProject;
  onAudio: (audio: AdAudio) => void;
  onProject: (p: AdProject) => void;
  onFlush?: () => Promise<void>;
  onSnap?: () => void; // snap page durations to audio.bpm (undoable, handled by AdEditor)
}) {
  const [tab, setTab] = useState<"library" | "generate">("library");
  const [busy, setBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [err, setErr] = useState("");
  const audio = project.audio;
  const bgm = audio.bgm;

  async function onUpload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const path = await uploadFile(file, project.projectId);
      onAudio({ ...audio, bgm: { kind: "upload", path } });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!prompt.trim()) return;
    setGenBusy(true);
    setErr("");
    try {
      await onFlush?.(); // server sizes the track to the saved video length
      onProject(await generateAdBgm(project.projectId, prompt.trim()));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setGenBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-bold">BGM</h2>
        <div className="ml-auto flex gap-1">
          <button onClick={() => setTab("library")} className={`rounded-md px-2.5 py-1 text-xs ${tab === "library" ? "bg-primary text-white" : "text-muted hover:bg-surface-muted"}`}>라이브러리 / 업로드</button>
          <button onClick={() => setTab("generate")} className={`rounded-md px-2.5 py-1 text-xs ${tab === "generate" ? "bg-primary text-white" : "text-muted hover:bg-surface-muted"}`}>AI 생성</button>
        </div>
      </div>

      {tab === "library" && (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onAudio({ ...audio, bgm: { kind: "none" } })}
            className={`rounded-md border px-3 py-1.5 text-left text-xs transition-all duration-200 ${bgm.kind === "none" ? "border-empathy bg-empathy/10 text-ink" : "border-border text-muted hover:border-empathy"}`}
          >
            사용 안 함
          </button>
          {LIBRARY.map((t) => (
            <button
              key={t.file}
              onClick={() => onAudio({ ...audio, bgm: { kind: "library", file: t.file } })}
              className={`flex items-center justify-between rounded-md border px-3 py-1.5 text-left text-xs transition-all duration-200 ${bgm.kind === "library" && bgm.file === t.file ? "border-empathy bg-empathy/10 text-ink" : "border-border text-muted hover:border-empathy"}`}
            >
              <span>♪ {t.label}</span>
              <audio controls preload="none" src={`/bgm/${t.file}`} className="h-7 w-40" onClick={(e) => e.stopPropagation()} />
            </button>
          ))}
          <label className="block cursor-pointer rounded-md border border-dashed border-border p-2.5 text-center text-xs text-muted transition-all duration-200 hover:border-empathy">
            {busy ? "업로드 중…" : bgm.kind === "upload" ? `업로드됨: ${bgm.path.split("/").pop()} (다시 선택)` : "BGM 파일 업로드 (mp3)"}
            <input type="file" accept="audio/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0])} />
          </label>
          {bgm.kind === "upload" && (
            <audio controls preload="none" src={fileUrl(bgm.path)} className="h-8 w-full" />
          )}
        </div>
      )}

      {tab === "generate" && (
        <div className="flex flex-col gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="원하는 분위기를 영어로 (예: upbeat playful electronic pop, light, 120 bpm)"
            className="h-16 w-full resize-y rounded-md border border-border bg-surface p-2 text-sm outline-none focus:border-primary"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={generate}
              disabled={genBusy || !prompt.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-all duration-200 hover:bg-primary-dark active:scale-[0.98] disabled:opacity-40"
            >
              {genBusy ? "생성 중… (최대 1~2분)" : "음악 생성"}
            </button>
            <span className="text-[11px] text-muted">영상 길이에 맞춰 생성됩니다.</span>
          </div>
          {bgm.kind === "upload" && (
            <div>
              <div className="mb-1 text-[11px] text-muted">현재 BGM</div>
              <audio controls preload="none" src={fileUrl(bgm.path)} className="h-8 w-full" />
            </div>
          )}
        </div>
      )}

      {err && <p className="mt-2 text-xs text-danger">{err}</p>}

      {bgm.kind !== "none" && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs text-muted">
            기본 볼륨 {Math.round((audio.baseVolume ?? DEFAULT_BASE_VOLUME) * 100)}%
            <input
              type="range" min={0} max={1} step={0.05}
              value={audio.baseVolume ?? DEFAULT_BASE_VOLUME}
              onChange={(e) => onAudio({ ...audio, baseVolume: parseFloat(e.target.value) })}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-xs text-muted">
            VO 덕킹 {Math.round((audio.duckVolume ?? DEFAULT_DUCK_VOLUME) * 100)}%
            <input
              type="range" min={0} max={1} step={0.05}
              value={audio.duckVolume ?? DEFAULT_DUCK_VOLUME}
              onChange={(e) => onAudio({ ...audio, duckVolume: parseFloat(e.target.value) })}
              className="mt-1 w-full"
            />
          </label>
        </div>
      )}

      {/* SFX — transition whoosh + entrance ding */}
      <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
        <button
          onClick={() => onAudio({ ...audio, sfxEnabled: !audio.sfxEnabled })}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 ${audio.sfxEnabled ? "bg-eli5 text-white" : "bg-ink/10 text-muted"}`}
        >
          효과음 {audio.sfxEnabled ? "켬" : "끔"}
        </button>
        <span className="text-[11px] text-muted">전환 휙(whoosh) + 팝/스탬프 등장 딩(ding)</span>
        {audio.sfxEnabled && (
          <label className="ml-auto flex items-center gap-2 text-xs text-muted">
            {Math.round((audio.sfxVolume ?? 0.7) * 100)}%
            <input
              type="range" min={0} max={1} step={0.05}
              value={audio.sfxVolume ?? 0.7}
              onChange={(e) => onAudio({ ...audio, sfxVolume: parseFloat(e.target.value) })}
              className="w-24"
            />
          </label>
        )}
      </div>

      {/* beat snap — align page cuts to the BGM tempo */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="text-xs text-muted">BPM</span>
        <input
          type="number" min={40} max={220}
          value={audio.bpm ?? ""}
          placeholder="예: 120"
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            onAudio({ ...audio, bpm: Number.isFinite(v) && v > 0 ? v : undefined });
          }}
          className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={onSnap}
          disabled={!audio.bpm}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink transition-all duration-200 hover:border-empathy disabled:opacity-40"
        >
          박자 스냅
        </button>
        <span className="text-[10px] leading-tight text-muted">페이지 길이를 박자 배수로 올림(VO는 잘리지 않음) · ⌘Z 취소 가능</span>
      </div>
    </section>
  );
}
