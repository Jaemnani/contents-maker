// decision 지점 — 사람(UI)과 러너(ad-auto.mjs)가 같은 함수로 stage를 전이시킨다 (AUTOMATION.md §3).
// L1: input(사람 선택)을 받아 전이. L2+에서는 input 없이 autoResolve 규칙으로 같은 전이를 밟는다.
// 긴 LLM 작업(package)은 잠금 밖에서 실행하고, 결과 반영만 mutateAdProject(잠금)로 쓴다.
import "server-only";
import { promises as fs } from "fs";
import crypto from "crypto";
import path from "path";
import {
  type AdProject,
  type FactorySource,
  type FactoryTopic,
  type FormatKind,
} from "@/lib/ad/schema";
import { mutateAdProject, projectDirAbs, projectRelDir, readAdProject } from "@/lib/ad/store";
import { pickTopicCandidates } from "@/lib/ad/factory/step1-topic";
import { packageByType } from "@/lib/ad/factory/step4-package";
import { buildShortsSpec, renderPerChannel } from "@/lib/ad/factory/step5-channel";
import { buildPublishPlan, factCheck } from "@/lib/ad/factory/step6-output";
import { AIB_CTA_URL, recommendFormats } from "@/lib/ad/factory/presets";
import { AIB_LOGO_ABS } from "@/lib/ad/factory/rules/voice";

/** 사용자 플로우 오류(선행 단계 미완, 중복 실행 등) — 라우트가 4xx로 매핑한다. */
export class FactoryFlowError extends Error {}

export type FactoryInput =
  | { op: "candidates" } // STEP1: 트렌드 수집 → 후보 3개 추천 (택1 대기)
  | { op: "topic"; topic: FactoryTopic }
  | { op: "formats"; selected: FormatKind[] }
  | { op: "source"; source: FactorySource }
  | { op: "package" }
  | { op: "published" }
  | { op: "reset" };

/** 캠페인 운영 날짜는 서비스 기준 시간대(한국)로 고정한다. */
function seoulDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export async function resolveDecision(projectId: string, input: FactoryInput): Promise<AdProject> {
  switch (input.op) {
    case "candidates": {
      // 생성 완료/발행된 배치를 무경고로 덮지 않는다 (LLM 비용 지출 전에 먼저 검사)
      const current = await readAdProject(projectId);
      guardNotFinalized(current);
      // 트렌드 수집 + LLM 스코어링은 잠금 밖(느림) — 결과 반영만 잠금 안에서
      const candidates = await pickTopicCandidates();
      return mutateAdProject(projectId, (p) => {
        guardNotFinalized(p);
        p.factory = { stage: "topic_candidates", automationLevel: 1, candidates };
      });
    }

    case "topic":
      // STEP1 확정(L1: 사람이 주제 입력) → STEP2 추천 프리셋 제시 상태로
      return mutateAdProject(projectId, (p) => {
        guardNotFinalized(p); // packaged/published 배치는 초기화 후에만 새 주제
        const recommended = recommendFormats(input.topic.supportedTypes);
        p.factory = {
          stage: "format_preset",
          automationLevel: 1,
          topic: input.topic,
          formatPreset: { recommended, selected: recommended },
        }; // 후보(candidates)는 택1과 함께 소진 — 새 배치는 다시 추천받는다
        p.meta.topic = input.topic.title; // 기존 파이프라인(대본/트렌드)과 주제 정렬
        // 추천 이미지 프롬프트 → seedPrompt: 페이지 편집의 "추천 프롬프트 불러오기"로 연결
        if (input.topic.imagePrompt) p.meta.seedPrompt = input.topic.imagePrompt;
      });

    case "formats":
      return mutateAdProject(projectId, (p) => {
        if (p.factory?.stage === "published") throw new FactoryFlowError("발행 완료된 배치입니다 — 초기화 후 새 배치를 시작하세요.");
        if (!p.factory?.topic) throw new FactoryFlowError("주제를 먼저 확정하세요.");
        if (!input.selected.length) throw new FactoryFlowError("포맷을 1개 이상 선택하세요.");
        p.factory.stage = "awaiting_source";
        p.factory.formatPreset = { recommended: p.factory.formatPreset?.recommended ?? [], selected: input.selected };
      });

    case "source":
      return mutateAdProject(projectId, (p) => {
        if (p.factory?.stage === "published") throw new FactoryFlowError("발행 완료된 배치입니다 — 초기화 후 새 배치를 시작하세요.");
        if (!p.factory?.topic) throw new FactoryFlowError("주제를 먼저 확정하세요.");
        if (!input.source.question.trim() || !input.source.modelA.answer.trim() || !input.source.modelB.answer.trim()) {
          throw new FactoryFlowError("질문과 두 모델의 답변을 모두 입력하세요.");
        }
        p.factory.stage = "awaiting_source"; // package 전까지 유지 (소재 수정 가능)
        p.factory.source = input.source;
      });

    case "package":
      return runPackage(projectId);

    case "published":
      return mutateAdProject(projectId, (p) => {
        if (p.factory?.stage !== "packaged" && p.factory?.stage !== "rendered" && p.factory?.stage !== "awaiting_publish") {
          throw new FactoryFlowError("발행할 콘텐츠가 없습니다 — 먼저 생성하세요.");
        }
        p.factory.stage = "published";
      });

    case "reset":
      return mutateAdProject(projectId, (p) => {
        p.factory = undefined;
      });
  }
}

/** aib 로고 락업을 프로젝트 assets/로 복사하고 outputs/-상대 경로를 돌려준다 (없으면 undefined → 기본 로고 폴백). */
export async function adoptAibLogo(projectId: string): Promise<string | undefined> {
  try {
    const dstDir = path.join(projectDirAbs(projectId), "assets");
    await fs.mkdir(dstDir, { recursive: true });
    await fs.copyFile(AIB_LOGO_ABS, path.join(dstDir, "aib-lockup-black.png"));
    return path.posix.join(projectRelDir(projectId), "assets", "aib-lockup-black.png");
  } catch {
    return undefined; // 스킬 에셋 없으면 기본 로고 폴백 (엔드카드가 public/brand/logo.png 사용)
  }
}

/** packaged/published 배치를 무경고로 덮는 op를 차단 — 명시적 '초기화'를 요구한다. */
function guardNotFinalized(p: AdProject): void {
  const stage = p.factory?.stage;
  if (stage === "packaged" || stage === "rendered" || stage === "awaiting_publish" || stage === "published") {
    throw new FactoryFlowError("이미 생성된 배치가 있습니다 — '초기화' 후 새 배치를 시작하세요.");
  }
}

const PACKAGING_STALE_MS = 10 * 60 * 1000; // 프로세스 사망 등으로 남은 플래그는 10분 후 무시

/** STEP4→5→6 자동 체인 (L1의 핵심). 쇼츠 포맷이면 이 프로젝트의 페이지·엔드카드를 채운다. */
async function runPackage(projectId: string): Promise<AdProject> {
  // 캠페인 ID·진행 플래그를 긴 LLM 작업 전에 잠금 안에서 선점한다. 동시 package 요청은
  // 둘 다 같은 캠페인을 쓰는 대신, 두 번째 요청이 즉시 거절된다 (LLM 이중 지출 방지).
  const snapshot = await mutateAdProject(projectId, (p) => {
    const f = p.factory;
    if (!f?.topic) throw new FactoryFlowError("주제를 먼저 확정하세요.");
    if (!(f.formatPreset?.selected.length)) throw new FactoryFlowError("포맷을 먼저 확정하세요.");
    if (!f.source) throw new FactoryFlowError("소재(aib.vote 비교 결과)를 먼저 입력하세요.");
    if (f.packagingAt && Date.now() - Date.parse(f.packagingAt) < PACKAGING_STALE_MS) {
      throw new FactoryFlowError("이미 콘텐츠 생성이 진행 중입니다 — 완료를 기다려 주세요.");
    }
    f.packagingAt = new Date().toISOString();
    f.campaign ??= `seed-${seoulDate()}-${crypto.randomBytes(4).toString("hex")}`;
  });
  try {
    return await runPackageChain(projectId, snapshot);
  } catch (e) {
    // 실패 시 진행 플래그 해제 — 다음 시도가 10분을 기다리지 않게
    await mutateAdProject(projectId, (p) => {
      if (p.factory) p.factory.packagingAt = undefined;
    }).catch(() => {});
    throw e;
  }
}

async function runPackageChain(projectId: string, snapshot: AdProject): Promise<AdProject> {
  const f = snapshot.factory;
  if (!f?.topic) throw new FactoryFlowError("주제를 먼저 확정하세요.");
  const formats = f.formatPreset?.selected ?? [];
  if (!formats.length) throw new FactoryFlowError("포맷을 먼저 확정하세요.");
  if (!f.source) throw new FactoryFlowError("소재(aib.vote 비교 결과)를 먼저 입력하세요.");

  // 위 잠금 구간에서 반드시 저장된다. 아래 검사는 스키마/코드 변경 시의 안전망이다.
  if (!f.campaign) throw new Error("캠페인 ID를 초기화하지 못했습니다.");
  const campaign = f.campaign;

  // STEP4: 유형별 골자 (되는 유형만)
  const pieces = await packageByType(f.topic, f.source, f.topic.supportedTypes);

  // STEP5+6 병렬: 채널 카피 · 쇼츠 명세 · 사실확인은 서로 독립 (pieces만 필요)
  const wantsVideo = formats.includes("shorts") || formats.includes("ugc_demo");
  // 쇼츠 추천 유형(거짓말·의견대립) 우선으로 영상 골자를 고른다
  const videoPiece = pieces.find((p) => p.type === "lie_speed") ?? pieces.find((p) => p.type === "opinion_clash") ?? pieces[0];
  // 사실확인 실패는 배치 전체를 버리지 않고 경고로 강등 (null = 실패 표시)
  const checksPromise = factCheck(f.source, pieces).catch(() => null);
  const [channel, shorts] = await Promise.all([
    renderPerChannel(f.topic, f.source, pieces, formats, campaign),
    wantsVideo ? buildShortsSpec(f.topic, f.source, videoPiece) : Promise.resolve(null),
  ]);
  const checks = await checksPromise;
  const warnings = [...channel.warnings];
  if (checks === null) warnings.push("사실확인 자동 목록화 실패 — 발행 전 수치·주장을 수동으로 점검하세요.");

  const plan = buildPublishPlan(channel.outputs, checks ?? [], formats, pieces.map((p) => p.type), warnings, campaign);

  // 브랜드 에셋: aib 로고 락업을 프로젝트로 복사 (엔드카드 로고)
  const logoRel = await adoptAibLogo(projectId);

  return mutateAdProject(projectId, (p) => {
    if (!p.factory) throw new Error("팩토리 상태가 초기화됐습니다 — 처음부터 다시 진행하세요.");
    if (p.factory.campaign !== campaign) {
      throw new Error("생성 중 팩토리 배치가 변경됐습니다 — 현재 배치에서 다시 생성하세요.");
    }
    p.factory.stage = "packaged";
    p.factory.packagingAt = undefined; // 진행 플래그 해제
    p.factory.campaign = campaign;
    p.factory.pieces = pieces;
    p.factory.plan = plan;
    if (shorts) {
      p.pages = shorts.pages; // 쇼츠 5컷으로 교체 (UI에서 사전 경고)
      p.endcard = {
        ...p.endcard,
        enabled: true,
        templateId: "logo-cta",
        transitionTemplateId: "zoom-blur",
        cta: AIB_CTA_URL,
        vo: shorts.endcardVo || p.endcard.vo,
        voAudio: shorts.endcardVo && shorts.endcardVo !== p.endcard.vo ? undefined : p.endcard.voAudio,
      };
    }
    p.product = {
      ...p.product,
      name: p.product.name.trim() ? p.product.name : "aib.vote",
      cta: AIB_CTA_URL,
      ...(logoRel ? { logoPath: logoRel } : {}),
    };
  });
}
