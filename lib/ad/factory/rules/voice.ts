// voice.md(말투 프로필)를 읽어 LLM 프롬프트로 주입하는 빌더.
// 규칙을 코드에 복붙하지 않는다 — md만 고치면 동작이 바뀐다 (스킬과 코드의 단일 진실).
import "server-only";
import { promises as fs } from "fs";
import path from "path";

export const SKILL_DIR = path.join(process.cwd(), ".claude", "skills", "aib-content-factory");
export const AIB_LOGO_ABS = path.join(SKILL_DIR, "assets", "aib-lockup-black.png");

async function readSkillFile(rel: string): Promise<string> {
  const abs = path.join(SKILL_DIR, rel);
  try {
    return await fs.readFile(abs, "utf-8");
  } catch {
    throw new Error(`스킬 참조 파일이 없습니다: ${abs} — .claude/skills/aib-content-factory를 복원하세요.`);
  }
}

/** voice.md 전문 — 카피 생성 프롬프트의 말투 섹션으로 주입한다. */
export async function voiceRules(): Promise<string> {
  const md = await readSkillFile(path.join("references", "voice.md"));
  return ["## 말투 규칙 (반드시 준수 — 위반 시 실패)", md].join("\n");
}
