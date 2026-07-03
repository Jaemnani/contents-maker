"use client";
// Automation: reuse a recent project as a template, auto-pick a topic from trends, and run
// the full pipeline N times/day. Configure here; the runner (scripts/ad-auto.mjs) fires runs.
import { useEffect, useMemo, useState } from "react";
import type { AdProject } from "@/lib/ad/schema";
import {
  listAutoConfigs,
  saveAutoConfig,
  deleteAutoConfig,
  runAutoConfig,
  type AutoConfig,
  type AutoSteps,
} from "@/lib/client/ad";
import { listTrendProviders, assetThumbUrl, fileUrl, type TrendProviderInfo } from "@/lib/client/wizard";
import { useModels } from "@/hooks/useModels";
import Select, { type SelectOption } from "@/components/ui/Select";
import { slotSource } from "@/lib/ad/schema";
import { visualSourceSlots, VISUAL_METAS, ENDCARD_METAS } from "@/remotion/ad/templates/meta";

const MODE_LABELS: [SlotMode, string][] = [
  ["reuse", "재사용"],
  ["gen", "생성"],
  ["link", "동일"],
];
type SlotMode = "reuse" | "gen" | "link";

const STEP_LABELS: [keyof AutoSteps, string][] = [
  ["text", "대본"],
  ["image", "이미지"],
  ["tts", "TTS"],
  ["bgm", "BGM"],
  ["render", "렌더"],
];
const ALL_STEPS: AutoSteps = { text: true, image: true, tts: true, bgm: true, render: true };

export default function AutomationPanel({ recent }: { recent: AdProject[] }) {
  const { data } = useModels();
  const [configs, setConfigs] = useState<AutoConfig[]>([]);
  const [providers, setProviders] = useState<TrendProviderInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  // form
  const [name, setName] = useState("자동 광고");
  const [templateId, setTemplateId] = useState("");
  const [dailyCount, setDailyCount] = useState(1);
  const [provider, setProvider] = useState("");
  const [keyword, setKeyword] = useState("");
  const [imageModel, setImageModel] = useState("");
  const [steps, setSteps] = useState<AutoSteps>(ALL_STEPS);
  const [regen, setRegen] = useState<Set<string>>(new Set()); // "i:slot" to GENERATE
  const [slotModels, setSlotModels] = useState<Record<string, string>>({});
  const [slotLinks, setSlotLinks] = useState<Record<string, string>>({});

  // "" = config default (cheapest) — an explicit, working option, not just a placeholder
  const imageModels: SelectOption[] = useMemo(() => {
    const list = data ? data.models.filter((m) => m.modality === "image").map((m) => ({ value: m.uid, label: m.label })) : [];
    return [{ value: "", label: "기본 (저가 자동)" }, ...list];
  }, [data]);
  const templateOptions: SelectOption[] = recent.map((p) => ({ value: p.projectId, label: `${p.meta.topic || p.product.name} · ${p.pages.length}p` }));

  // default to the most recent project until the user picks one (no effect needed)
  const effTemplate = templateId || recent[0]?.projectId || "";
  const tmplProject = recent.find((r) => r.projectId === effTemplate);
  // keys are "<pageId>:<slot>" — stable when the template is later reordered/edited
  const allSlots = tmplProject
    ? tmplProject.pages.flatMap((p, i) => visualSourceSlots(p.visualTemplateId).map((s) => ({ key: `${p.id}:${s.key}`, label: `P${i + 1} ${s.key}` })))
    : [];

  const resetTemplate = (v: string) => { setTemplateId(v); setRegen(new Set()); setSlotModels({}); setSlotLinks({}); };
  const slotMode = (key: string): SlotMode => (slotLinks[key] ? "link" : regen.has(key) ? "gen" : "reuse");
  function setMode(key: string, mode: SlotMode) {
    setRegen((s) => { const n = new Set(s); if (mode === "gen") n.add(key); else n.delete(key); return n; });
    setSlotLinks((l) => {
      const n = { ...l };
      if (mode === "link") n[key] = n[key] || allSlots.find((o) => o.key !== key)?.key || "";
      else delete n[key];
      return n;
    });
  }

  const refresh = () => listAutoConfigs().then(setConfigs).catch(() => setConfigs([]));
  useEffect(() => { refresh(); }, []);
  useEffect(() => { listTrendProviders("ko").then(setProviders).catch(() => setProviders([])); }, []);

  async function save() {
    if (!effTemplate) { setMsg("템플릿(최근 프로젝트)을 선택하세요."); return; }
    setBusy("save"); setMsg("");
    try {
      await saveAutoConfig({ name, templateProjectId: effTemplate, dailyCount, topicProvider: provider, topicKeyword: keyword, imageModel, regen: [...regen], slotModels, slotLinks, steps, enabled: true });
      await refresh();
      setMsg("저장됨.");
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
  }
  async function toggle(c: AutoConfig) {
    try {
      await saveAutoConfig({ ...c, enabled: !c.enabled });
      refresh();
    } catch (e) { setMsg(`설정 변경 실패: ${(e as Error).message}`); }
  }
  async function remove(id: string) {
    if (!window.confirm("이 자동화 설정을 삭제할까요?")) return;
    try {
      await deleteAutoConfig(id);
      refresh();
    } catch (e) { setMsg(`삭제 실패: ${(e as Error).message}`); }
  }
  async function runNow(c: AutoConfig) {
    setBusy(c.id); setMsg(`"${c.name}" 1회 생성 중… (대본·이미지·TTS·BGM·렌더, 수 분 소요)`);
    try {
      const r = await runAutoConfig(c.id);
      setMsg(`완료: ${r.projectId} · 주제 "${r.topic}" · 단계 ${r.steps.join("·")}${r.warnings.length ? ` · 경고 ${r.warnings.length}건` : ""}`);
      refresh();
    } catch (e) { setMsg(`실패: ${(e as Error).message}`); } finally { setBusy(null); }
  }

  return (
    <section className="mb-8 rounded-2xl border border-border bg-surface p-5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left">
        <h2 className="text-base font-bold">🤖 자동화 <span className="text-xs font-normal text-muted">템플릿 + 트렌드 주제로 하루 N회 자동 생성</span></h2>
        <span className="ml-auto text-xs text-muted">{open ? "접기 ▲" : `펼치기 ▼ (설정 ${configs.length}개)`}</span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-4">
          {/* form */}
          <div className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-2">
            <label className="text-xs text-muted">이름
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-base text-ink outline-none focus:border-primary" />
            </label>
            <label className="text-xs text-muted">템플릿 (최근 프로젝트의 구조·BGM·엔드카드 재사용)
              <Select value={effTemplate} options={templateOptions} onChange={resetTemplate} placeholder={recent.length ? "선택" : "최근 프로젝트 없음 — 먼저 하나 만드세요"} />
            </label>
            <label className="text-xs text-muted">하루 생성 횟수
              <input type="number" min={1} max={48} value={dailyCount} onChange={(e) => setDailyCount(Math.max(1, parseInt(e.target.value, 10) || 1))} className="mt-1 w-24 rounded-md border border-border bg-surface px-3 py-1.5 text-base text-ink outline-none focus:border-primary" />
            </label>
            <label className="text-xs text-muted">이미지 모델 (자동 생성용)
              <Select value={imageModel} options={imageModels} onChange={setImageModel} placeholder="기본(저가) 자동" />
            </label>
            <div className="text-xs text-muted md:col-span-2">
              주제 소스
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <button onClick={() => setProvider("")} className={`rounded-md border px-2.5 py-1 text-xs ${provider === "" ? "border-empathy bg-empathy/10 text-ink" : "border-border text-muted hover:border-empathy"}`}>키워드만</button>
                {providers.map((p) => (
                  <button key={p.id} onClick={() => setProvider(p.id)} className={`rounded-md border px-2.5 py-1 text-xs ${provider === p.id ? "border-empathy bg-empathy/10 text-ink" : "border-border text-muted hover:border-empathy"}`}>{p.label}</button>
                ))}
                <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="키워드(선택)" className="ml-1 min-w-[160px] flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-primary" />
              </div>
            </div>
            <div className="text-xs text-muted md:col-span-2">
              자동 생성 단계
              <div className="mt-1 flex flex-wrap gap-1.5">
                {STEP_LABELS.map(([k, label]) => (
                  <button key={k} onClick={() => setSteps((s) => ({ ...s, [k]: !s[k] }))} className={`rounded-md border px-2.5 py-1 text-xs ${steps[k] ? "border-empathy bg-empathy/10 text-ink" : "border-border text-muted hover:border-empathy"}`}>{label}</button>
                ))}
              </div>
            </div>

            {/* per-slot image plan: 재사용(template) / 생성(new, costs) / 동일(copy another slot) */}
            {steps.image && tmplProject && (
              <div className="text-xs text-muted md:col-span-2">
                이미지 슬롯별 계획 <span className="text-[10px]">(생성=새로 만듦·과금 / 재사용=템플릿 그대로 / 동일=다른 슬롯 이미지 복사 · 2분할 비교는 기본값일 때 A/B를 자동으로 서로 다른 모델로 생성)</span>
                <div className="mt-1.5 flex flex-col gap-2 rounded-md border border-border p-2">
                  {tmplProject.pages.map((p, i) => (
                    <div key={p.id} className="flex flex-col gap-1.5 border-b border-border/60 pb-1.5 last:border-0 last:pb-0">
                      <span className="text-[11px] font-medium text-ink">{i + 1}. {VISUAL_METAS[p.visualTemplateId]?.name ?? p.visualTemplateId}{p.sourceType === "video" ? " (영상·생성 미지원)" : ""}</span>
                      <div className="flex flex-wrap gap-2">
                        {visualSourceSlots(p.visualTemplateId).map((s) => {
                          const key = `${p.id}:${s.key}`;
                          const mode = slotMode(key);
                          const src = slotSource(p, s.key);
                          const thumb = src.kind === "asset" ? assetThumbUrl(src.ref) : src.kind === "upload" ? fileUrl(src.path) : null;
                          return (
                            <div key={key} className="flex items-center gap-1.5 rounded-md border border-border p-1.5">
                              {thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={thumb} alt="" className="h-9 w-5 shrink-0 rounded-sm object-cover" />
                              ) : (
                                <span className="grid h-9 w-5 shrink-0 place-items-center rounded-sm bg-ink/10 text-[8px]">∅</span>
                              )}
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-semibold text-ink">{s.key}</span>
                                  {MODE_LABELS.map(([m, label]) => (
                                    <button key={m} onClick={() => setMode(key, m)} className={`rounded border px-1.5 py-0.5 text-[10px] ${mode === m ? "border-empathy bg-empathy/10 text-ink" : "border-border text-muted hover:border-empathy"}`}>{label}</button>
                                  ))}
                                </div>
                                {mode === "gen" && (
                                  <Select value={slotModels[key] ?? ""} options={imageModels} onChange={(v) => setSlotModels((m) => ({ ...m, [key]: v }))} />
                                )}
                                {mode === "link" && (
                                  <Select value={slotLinks[key] ?? ""} options={allSlots.filter((o) => o.key !== key).map((o) => ({ value: o.key, label: o.label }))} onChange={(v) => setSlotLinks((l) => ({ ...l, [key]: v }))} placeholder="원본 슬롯" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* endcard — reused from the template as-is */}
            {tmplProject && (
              <div className="text-xs text-muted md:col-span-2">
                엔드카드 <span className="text-[10px]">(템플릿 그대로 사용 — 로고/문구 포함)</span>
                <div className="mt-1 rounded-md border border-border p-2 text-[11px] text-ink">
                  {tmplProject.endcard.enabled
                    ? `${ENDCARD_METAS[tmplProject.endcard.templateId]?.name ?? tmplProject.endcard.templateId} · 길이 ${tmplProject.endcard.durationSec ?? 3}s · 문구 "${tmplProject.endcard.cta || tmplProject.endcard.subtitle || tmplProject.product.cta || ""}"${tmplProject.product.logoPath ? " · 커스텀 로고" : " · 기본 로고"}`
                    : "미사용"}
                </div>
              </div>
            )}
            <div className="md:col-span-2">
              <button onClick={save} disabled={busy === "save"} className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-primary-dark active:scale-[0.98] disabled:opacity-40">
                {busy === "save" ? "저장 중…" : "설정 저장 / 추가"}
              </button>
            </div>
          </div>

          {msg && <p className="text-xs text-empathy">{msg}</p>}

          {/* saved configs */}
          {configs.length > 0 && (
            <div className="flex flex-col gap-2">
              {configs.map((c) => {
                const tmpl = recent.find((r) => r.projectId === c.templateProjectId);
                return (
                  <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2.5 text-sm">
                    <button onClick={() => toggle(c)} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.enabled ? "bg-eli5 text-white" : "bg-ink/10 text-muted"}`}>{c.enabled ? "사용" : "중지"}</button>
                    <span className="font-medium text-ink">{c.name}</span>
                    <span className="text-xs text-muted">하루 {c.dailyCount}회 · {tmpl ? (tmpl.meta.topic || tmpl.product.name) : "템플릿?"} · {STEP_LABELS.filter(([k]) => c.steps[k]).map(([, l]) => l).join("·")} · 이미지 {c.regen.length}슬롯 재생성</span>
                    {c.lastRunAt && <span className="text-[11px] text-muted">최근 {new Date(c.lastRunAt).toLocaleString()}</span>}
                    <div className="ml-auto flex gap-1.5">
                      <button onClick={() => runNow(c)} disabled={!!busy} className="rounded border border-border px-2 py-0.5 text-xs text-ink hover:border-empathy disabled:opacity-40">{busy === c.id ? "생성 중…" : "지금 1회"}</button>
                      <button onClick={() => remove(c.id)} className="rounded border border-border px-2 py-0.5 text-xs text-danger hover:border-danger">삭제</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-muted">
            ⏰ 실제 24시간 자동 실행은 러너가 필요합니다 — 앱을 켜둔 채 터미널에서 <code className="rounded bg-ink/10 px-1">node scripts/ad-auto.mjs</code> 를 실행해 두세요(또는 pm2/cron). 러너가 설정을 읽어 하루 횟수에 맞춰 실행합니다. 위 “지금 1회”는 즉시 테스트용입니다.
          </p>
        </div>
      )}
    </section>
  );
}
