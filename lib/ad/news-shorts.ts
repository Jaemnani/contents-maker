// 뉴스 → 숏폼: aib.vote/news 기사(들)로 쇼츠 컷 명세를 만들어 프로젝트에 채운다.
// 모드 2종 — brief(순수 뉴스 브리핑) / ai_react(브리핑 + "AI들에게 물어본다면?" 질문 컷 + aib 유도).
// 형식은 기사 개수로 결정: 1건 = 단일 집중형, 2~5건 = 다이제스트.
// 사실성 원칙: 대본은 기사에 명시된 사실·수치만 쓴다. AI의 답변을 지어내지 않는다 —
// ai_react 모드도 "질문 제기 + 직접 비교 유도"까지만 (모델 답 창작 금지).
import "server-only";
import { z } from "zod";
import { newAdPage, type AdPage, type AdProject } from "@/lib/ad/schema";
import { mutateAdProject } from "@/lib/ad/store";
import { factoryLlm } from "@/lib/ad/factory/llm";
import { sanitizeVoice } from "@/lib/ad/factory/step5-channel";
import { adoptAibLogo, FactoryFlowError } from "@/lib/ad/factory/decision";
import { AIB_CTA_URL } from "@/lib/ad/factory/presets";

export type NewsShortsMode = "brief" | "ai_react";

// 크롤러의 AibNewsItem에서 대본에 필요한 필드만 — slug 등 부가 필드는 클라이언트 왕복에서 생략 가능
export const zNewsShortsItem = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.array(z.string()).default([]),
  details: z.string().optional(),
  source: z.string(),
  articleUrl: z.string().optional(),
  aibUrl: z.string(),
  publishedAt: z.string(),
  keywords: z.array(z.string()).default([]),
});
export type NewsShortsItem = z.infer<typeof zNewsShortsItem>;

interface Cut {
  visual: string;
  motion: string;
  transition: string;
  role: string;
}

const HOOK: Cut = { visual: "fullscreen-title", motion: "whip-zoom-in", transition: "cut", role: "훅 — 뉴스의 가장 놀라운 지점으로 시선을 잡는다" };
const QUESTION: Cut = { visual: "fullscreen-title", motion: "caption-pop", transition: "zoom-blur", role: '"이 뉴스, AI들에게 물어본다면?" — 견해가 갈릴 질문 하나를 제기하고 직접 비교를 유도 (AI의 답을 지어내지 말 것)' };

/** 단일 집중형 (기사 1건): 훅 → 핵심 → 디테일 → 포인트 → 의미 (+ ai_react 질문). */
function singleStructure(mode: NewsShortsMode): Cut[] {
  return [
    HOOK,
    { visual: "split-media-text", motion: "ken-burns-zoom", transition: "cut", role: "핵심 — 무슨 일이 있었는지 한 문장 요약 (출처 매체를 자연스럽게 언급)" },
    { visual: "quote-card", motion: "drift-up", transition: "whip-pan", role: "디테일 — 기사 속 구체적 사실/발언 하나 (기사에 있는 내용만)" },
    { visual: "big-stat", motion: "caption-pop", transition: "glitch", role: "포인트 — 기사 속 핵심 수치나 키워드 강조 (기사에 없는 수치 금지)" },
    { visual: "split-media-text", motion: "ken-burns-zoom", transition: mode === "ai_react" ? "cut" : "zoom-blur", role: "의미 — 이 뉴스가 왜 중요한지, 무엇이 달라지는지" },
    ...(mode === "ai_react" ? [QUESTION] : []),
  ];
}

/** 다이제스트 (2~5건): 훅 → 꼭지별 1컷 → 마무리(또는 질문). */
function digestStructure(n: number, mode: NewsShortsMode): Cut[] {
  const item = (i: number): Cut => ({
    visual: i % 2 === 0 ? "split-media-text" : "quote-card",
    motion: i % 2 === 0 ? "ken-burns-zoom" : "drift-up",
    transition: "whip-pan",
    role: `꼭지 ${i + 1} — ${i + 1}번 기사 요약 (핵심 사실 하나 + 왜 화제인지)`,
  });
  const closing: Cut =
    mode === "ai_react"
      ? QUESTION
      : { visual: "split-media-text", motion: "ken-burns-zoom", transition: "zoom-blur", role: "마무리 — 오늘 흐름 한 줄 정리" };
  return [
    { ...HOOK, role: "훅 — '오늘의 AI 뉴스' 다이제스트 오프닝 (가장 큰 꼭지를 미끼로)" },
    ...Array.from({ length: n }, (_, i) => item(i)),
    closing,
  ];
}

const zOut = z.object({
  pages: z.array(z.object({ caption: z.string(), vo: z.string(), imagePrompt: z.string() })),
  endcardVo: z.string().optional(),
});

/** 기사 본문을 프롬프트 예산 안으로 자른다 (요약이 이미 핵심을 담고 있음). */
const clip = (t: string | undefined, max = 1600) => (t && t.length > max ? t.slice(0, max) + "…" : t);

export interface NewsShortsResult {
  project: AdProject;
  warnings: string[];
}

/** 뉴스 기사(들) → 쇼츠 컷을 생성해 프로젝트 pages/endcard/meta에 반영한다. */
export async function buildNewsShorts(
  projectId: string,
  mode: NewsShortsMode,
  items: NewsShortsItem[],
  aibEndcard: boolean
): Promise<NewsShortsResult> {
  if (!items.length) throw new FactoryFlowError("기사를 1개 이상 선택하세요.");
  if (items.length > 5) throw new FactoryFlowError("다이제스트는 최대 5꼭지까지입니다.");
  const single = items.length === 1;
  const structure = single ? singleStructure(mode) : digestStructure(items.length, mode);
  const withAib = aibEndcard || mode === "ai_react"; // 질문 컷은 투표 유도가 목적 — 엔드카드 필수

  const sys = [
    "You are a Korean news-shorts scriptwriter (9:16 vertical, 15-40s). 뉴스 채널 톤: 담백한 존댓말(~요/~네요), 과장 없이, 문장은 짧게.",
    `${structure.length}컷 구조에 맞춰 각 컷의 caption(화면 자막), vo(내레이션), imagePrompt를 쓴다.`,
    "",
    `컷 구조 (순서 고정, 정확히 ${structure.length}개 출력):`,
    ...structure.map((s, i) => `${i + 1}. ${s.role}`),
    "",
    "사실성 규칙 (위반 시 실패):",
    "- 기사에 명시된 사실·수치·발언만 쓴다. 기사에 없는 내용을 추론해 사실처럼 말하지 않는다.",
    "- 전망·해석 컷은 '~할 것으로 보입니다' 같은 해석임이 드러나는 표현으로.",
    "- AI 모델의 답변·반응을 지어내지 않는다 (질문 컷은 질문만 던진다).",
    "- 이모지·긴 대시(—) 금지.",
    "",
    "형식 규칙:",
    "- caption: 한국어 20자 이내, 펀치있게.",
    "- vo: 컷당 2~4초(15~30음절), 자연스러운 구어체 존댓말.",
    "- imagePrompt: 그 컷의 배경 이미지를 만들 한국어 장면 묘사 한 문장 — 세로 화면 단일 장면, 이미지 속 글자 금지, 실존 인물 얼굴 대신 은유(로봇·상징물)로.",
    withAib ? "- endcardVo: 마지막 한 마디 (직접 비교/투표 유도, 예: 'aib.vote에서 직접 비교해보세요')." : "- endcardVo는 생략.",
    "",
    'Output ONLY this JSON: {"pages":[{"caption":"...","vo":"...","imagePrompt":"..."}],"endcardVo":"..."}',
  ].join("\n");

  const user = JSON.stringify({
    mode,
    articles: items.map((n, i) => ({
      idx: i + 1,
      title: n.title,
      source: n.source,
      publishedAt: n.publishedAt,
      summary: n.summary,
      details: clip(n.details),
    })),
  });

  const out = await factoryLlm(zOut, sys, user, 6000);
  if (out.pages.length < structure.length) {
    throw new Error(`컷이 ${out.pages.length}개만 생성됐습니다 (${structure.length}개 필요) — 다시 시도해 주세요.`);
  }

  const pages: AdPage[] = structure.map((s, i) => ({
    ...newAdPage("image"),
    visualTemplateId: s.visual,
    motionTemplateId: s.motion,
    transitionTemplateId: s.transition,
    caption: sanitizeVoice(out.pages[i].caption),
    vo: sanitizeVoice(out.pages[i].vo),
    imagePrompt: out.pages[i].imagePrompt,
  }));

  const logoRel = withAib ? await adoptAibLogo(projectId) : undefined;
  const topic = single ? items[0].title : `오늘의 AI 뉴스 ${items.length}선 (${items[0].publishedAt})`;

  const project = await mutateAdProject(projectId, (p) => {
    p.pages = pages;
    p.meta.topic = topic;
    p.meta.seedPrompt = out.pages[0]?.imagePrompt || p.meta.seedPrompt; // 훅 이미지 컨셉 재사용
    if (withAib) {
      p.endcard = {
        ...p.endcard,
        enabled: true,
        templateId: "logo-cta",
        transitionTemplateId: "zoom-blur",
        cta: AIB_CTA_URL,
        vo: out.endcardVo ? sanitizeVoice(out.endcardVo) : p.endcard.vo,
        voAudio: out.endcardVo && out.endcardVo !== p.endcard.vo ? undefined : p.endcard.voAudio,
      };
      p.product = {
        ...p.product,
        name: p.product.name.trim() ? p.product.name : "aib.vote",
        cta: AIB_CTA_URL,
        ...(logoRel ? { logoPath: logoRel } : {}),
      };
    } else {
      p.endcard = { ...p.endcard, enabled: false }; // 순수 브리핑 — 엔드카드 없이 마무리
    }
  });

  const warnings: string[] = [];
  if (items.some((n) => !n.details && !n.summary.length)) {
    warnings.push("일부 기사는 요약·본문이 비어 제목만으로 대본을 썼습니다 — 사실 확인을 권장합니다.");
  }
  return { project, warnings };
}
