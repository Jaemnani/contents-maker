// decision 지점 — 사람(UI)과 러너(ad-auto.mjs)가 같은 함수로 stage를 전이시킨다 (AUTOMATION.md §3).
// L1: input(사람 선택)을 받아 전이. L2+에서는 input 없이 autoResolve 규칙으로 같은 전이를 밟는다.
// 긴 LLM 작업(package)은 잠금 밖에서 실행하고, 결과 반영만 mutateAdProject(잠금)로 쓴다.
import "server-only";
import { promises as fs } from "fs";
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
import { AIB_CTA, recommendFormats } from "@/lib/ad/factory/presets";
import { AIB_LOGO_ABS } from "@/lib/ad/factory/rules/voice";

export type FactoryInput =
  | { op: "candidates" } // STEP1: 트렌드 수집 → 후보 3개 추천 (택1 대기)
  | { op: "topic"; topic: FactoryTopic }
  | { op: "formats"; selected: FormatKind[] }
  | { op: "source"; source: FactorySource }
  | { op: "package" }
  | { op: "published" }
  | { op: "reset" };

export async function resolveDecision(projectId: string, input: FactoryInput): Promise<AdProject> {
  switch (input.op) {
    case "candidates": {
      // 트렌드 수집 + LLM 스코어링은 잠금 밖(느림) — 결과 반영만 잠금 안에서
      const candidates = await pickTopicCandidates();
      return mutateAdProject(projectId, (p) => {
        p.factory = { stage: "topic_candidates", automationLevel: 1, candidates };
      });
    }

    case "topic":
      // STEP1 확정(L1: 사람이 주제 입력) → STEP2 추천 프리셋 제시 상태로
      return mutateAdProject(projectId, (p) => {
        const recommended = recommendFormats(input.topic.supportedTypes);
        p.factory = {
          stage: "format_preset",
          automationLevel: 1,
          topic: input.topic,
          formatPreset: { recommended, selected: recommended },
        }; // 후보(candidates)는 택1과 함께 소진 — 새 배치는 다시 추천받는다
        p.meta.topic = input.topic.title; // 기존 파이프라인(대본/트렌드)과 주제 정렬
      });

    case "formats":
      return mutateAdProject(projectId, (p) => {
        if (!p.factory?.topic) throw new Error("주제를 먼저 확정하세요.");
        if (!input.selected.length) throw new Error("포맷을 1개 이상 선택하세요.");
        p.factory.stage = "awaiting_source";
        p.factory.formatPreset = { recommended: p.factory.formatPreset?.recommended ?? [], selected: input.selected };
      });

    case "source":
      return mutateAdProject(projectId, (p) => {
        if (!p.factory?.topic) throw new Error("주제를 먼저 확정하세요.");
        if (!input.source.question.trim() || !input.source.modelA.answer.trim() || !input.source.modelB.answer.trim()) {
          throw new Error("질문과 두 모델의 답변을 모두 입력하세요.");
        }
        p.factory.stage = "awaiting_source"; // package 전까지 유지 (소재 수정 가능)
        p.factory.source = input.source;
      });

    case "package":
      return runPackage(projectId);

    case "published":
      return mutateAdProject(projectId, (p) => {
        if (p.factory?.stage !== "packaged" && p.factory?.stage !== "rendered" && p.factory?.stage !== "awaiting_publish") {
          throw new Error("발행할 콘텐츠가 없습니다 — 먼저 생성하세요.");
        }
        p.factory.stage = "published";
      });

    case "reset":
      return mutateAdProject(projectId, (p) => {
        p.factory = undefined;
      });
  }
}

/** STEP4→5→6 자동 체인 (L1의 핵심). 쇼츠 포맷이면 이 프로젝트의 페이지·엔드카드를 채운다. */
async function runPackage(projectId: string): Promise<AdProject> {
  const snapshot = await readAdProject(projectId);
  const f = snapshot.factory;
  if (!f?.topic) throw new Error("주제를 먼저 확정하세요.");
  const formats = f.formatPreset?.selected ?? [];
  if (!formats.length) throw new Error("포맷을 먼저 확정하세요.");
  if (!f.source) throw new Error("소재(aib.vote 비교 결과)를 먼저 입력하세요.");

  // STEP4: 유형별 골자 (되는 유형만)
  const pieces = await packageByType(f.topic, f.source, f.topic.supportedTypes);

  // STEP5: 채널 카피 + (쇼츠 선택 시) 이 프로젝트의 페이지 명세
  const wantsVideo = formats.includes("shorts") || formats.includes("ugc_demo");
  // 쇼츠 추천 유형(거짓말·의견대립) 우선으로 영상 골자를 고른다
  const videoPiece = pieces.find((p) => p.type === "lie_speed") ?? pieces.find((p) => p.type === "opinion_clash") ?? pieces[0];
  const [channel, shorts] = await Promise.all([
    renderPerChannel(f.topic, f.source, pieces, formats),
    wantsVideo ? buildShortsSpec(f.topic, f.source, videoPiece) : Promise.resolve(null),
  ]);

  // STEP6: 사실확인 체크(필수 고정 항목) + 배포 플랜
  const checks = await factCheck(f.source, pieces);
  const plan = buildPublishPlan(channel.outputs, checks, formats, pieces.map((p) => p.type), channel.warnings);

  // 브랜드 에셋: aib 로고 락업을 프로젝트로 복사 (엔드카드 로고)
  let logoRel: string | undefined;
  try {
    const dstDir = path.join(projectDirAbs(projectId), "assets");
    await fs.mkdir(dstDir, { recursive: true });
    await fs.copyFile(AIB_LOGO_ABS, path.join(dstDir, "aib-lockup-black.png"));
    logoRel = path.posix.join(projectRelDir(projectId), "assets", "aib-lockup-black.png");
  } catch {
    logoRel = undefined; // 스킬 에셋 없으면 기본 로고 폴백 (엔드카드가 public/brand/logo.png 사용)
  }

  return mutateAdProject(projectId, (p) => {
    if (!p.factory) throw new Error("팩토리 상태가 초기화됐습니다 — 처음부터 다시 진행하세요.");
    p.factory.stage = "packaged";
    p.factory.pieces = pieces;
    p.factory.plan = plan;
    if (shorts) {
      p.pages = shorts.pages; // 쇼츠 5컷으로 교체 (UI에서 사전 경고)
      p.endcard = {
        ...p.endcard,
        enabled: true,
        templateId: "logo-cta",
        transitionTemplateId: "zoom-blur",
        cta: AIB_CTA,
        vo: shorts.endcardVo || p.endcard.vo,
        voAudio: shorts.endcardVo && shorts.endcardVo !== p.endcard.vo ? undefined : p.endcard.voAudio,
      };
    }
    p.product = {
      ...p.product,
      name: p.product.name.trim() ? p.product.name : "aib.vote",
      cta: AIB_CTA,
      ...(logoRel ? { logoPath: logoRel } : {}),
    };
  });
}
