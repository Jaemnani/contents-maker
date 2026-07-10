// shortform_distribution.md(플랫폼별 배포 표준)를 읽어 LLM 프롬프트로 주입하는 빌더.
// 비율·2단 구성·AI라벨 같은 "코드가 보장하는 규칙"은 presets.ts의 CHANNEL_SPECS에 있고,
// 문구 형식·톤은 md 원문을 그대로 프롬프트에 넣는다 (md = 단일 진실).
import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { SKILL_DIR } from "@/lib/ad/factory/rules/voice";

/** shortform_distribution.md 전문 — 숏폼 채널 카피 생성 시 형식 가이드로 주입. */
export async function distributionRules(): Promise<string> {
  const abs = path.join(SKILL_DIR, "references", "shortform_distribution.md");
  try {
    const md = await fs.readFile(abs, "utf-8");
    return ["## 숏폼 배포 표준 형식 (플랫폼별 그대로 따를 것)", md].join("\n");
  } catch {
    throw new Error(`스킬 참조 파일이 없습니다: ${abs} — .claude/skills/aib-content-factory를 복원하세요.`);
  }
}
