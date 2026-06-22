"use client";
// Main landing = Ad maker: create (9-beat preset | empty) + topic (free text or trend pick)
// + recent ad projects. Mounts AdEditor for an active project.
import { useEffect, useState } from "react";
import Link from "next/link";
import type { AdProject } from "@/lib/ad/schema";
import { createAdProject, listAdProjects, getAdProject } from "@/lib/client/ad";
import { pickText } from "@/lib/render/strings";
import TopicSuggest from "@/components/wizard/TopicSuggest";
import type { TopicCandidate } from "@/lib/client/wizard";
import AdEditor from "@/components/ad/AdEditor";

export default function Home() {
  const [project, setProject] = useState<AdProject | null>(null);
  const [recent, setRecent] = useState<AdProject[]>([]);
  const [topic, setTopic] = useState("");
  const [chosen, setChosen] = useState<TopicCandidate | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!project) listAdProjects().then(setRecent).catch(() => setRecent([]));
  }, [project]);

  async function create(preset: "tapnow-9beat" | "empty") {
    setCreating(true);
    try {
      setProject(
        await createAdProject({
          preset,
          topic: topic.trim() || undefined,
          seedPrompt: chosen?.comparePrompt, // carry the suggested base image prompt into the project
        })
      );
    } finally {
      setCreating(false);
    }
  }

  if (project) return <AdEditor project={project} onExit={() => setProject(null)} />;

  return (
    <main className="mx-auto w-full max-w-[1280px] grow px-5 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            광고 <span className="text-primary">메이커</span>
          </h1>
          <p className="text-sm text-muted">페이지 조립형 제품 광고 숏폼 — 9:16</p>
        </div>
        <Link href="/studio" className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted transition-colors duration-200 hover:border-empathy hover:text-ink">
          이미지·영상 개별 생성 →
        </Link>
      </header>

      <section className="mb-8 rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-base font-bold">새 광고 만들기</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[280px] flex-1">
            <div className="mb-1 text-xs text-muted">주제 (직접 입력 또는 아래 추천에서 선택)</div>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="예: AI 영상 에디터"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-primary"
            />
          </div>
          <button onClick={() => create("tapnow-9beat")} disabled={creating} className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-primary-dark active:scale-[0.98] disabled:opacity-40">
            {creating ? "생성 중…" : "9-beat 프리셋으로 시작"}
          </button>
          <button onClick={() => create("empty")} disabled={creating} className="rounded-md border border-border bg-surface px-5 py-2 text-sm font-semibold text-ink transition-all duration-200 hover:border-empathy active:scale-[0.98] disabled:opacity-40">
            빈 프로젝트
          </button>
        </div>

        <TopicSuggest
          language="ko"
          chosen={chosen}
          onPick={(c) => {
            setChosen(c);
            if (c) setTopic(pickText(c.headline, "ko") || c.term);
          }}
        />
      </section>

      <section>
        <h2 className="mb-3 text-base font-bold">최근 광고 프로젝트</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">아직 프로젝트가 없습니다. 위에서 새 광고를 시작하세요.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {recent.map((p) => (
              <button
                key={p.projectId}
                onClick={() => getAdProject(p.projectId).then(setProject)}
                className="rounded-lg border border-border bg-surface p-3 text-left transition-all duration-200 hover:border-empathy hover:-translate-y-px"
              >
                <div className="truncate text-sm font-semibold text-ink">{p.meta.topic || p.product.name}</div>
                <div className="mt-1 text-[11px] text-muted">
                  {p.pages.length}페이지 · {new Date(p.createdAt).toLocaleString()}
                </div>
                <div className="mt-0.5 text-[11px] text-muted">{p.latestRender ? "렌더 완료" : "미렌더"}</div>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
