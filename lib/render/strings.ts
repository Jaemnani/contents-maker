// Topic-extensible default copy + CTA presets + card background templates (ko/ja/en).
// Palette aligns with docs/DESIGN.md tokens (ink #0b1215, primary #0067b7, canvas #fafaf6).
import type { Language, LocalizedText } from "@/lib/composition-types";

export interface TopicCopy {
  headline: LocalizedText;
  sub: LocalizedText;
}

export interface Topic {
  id: string;
  label: string;
  copy: TopicCopy;
}

export const TOPICS: Record<string, Topic> = {
  "same-prompt-different-ai": {
    id: "same-prompt-different-ai",
    label: "같은 프롬프트 다른 AI",
    copy: {
      headline: { ko: "같은 프롬프트 다른 AI", ja: "同じプロンプト、違うAI", en: "Same Prompt, Different AI" },
      sub: { ko: "어느쪽이 더 좋아?", ja: "どっちがいい？", en: "Which one's better?" },
    },
  },
};

export const DEFAULT_TOPIC_ID = "same-prompt-different-ai";

export const CTA_PRESETS: { id: string; text: LocalizedText }[] = [
  { id: "comment", text: { ko: "댓글로 골라줘!", ja: "コメントで選んでね！", en: "Pick one in the comments!" } },
  { id: "which-better", text: { ko: "어느쪽이 더 좋아?", ja: "どっちがいい？", en: "Which one's better?" } },
  { id: "follow", text: { ko: "더 보려면 팔로우!", ja: "もっと見るならフォロー！", en: "Follow for more!" } },
];

export interface CardTemplate {
  id: string;
  label: string;
  kind: "gradient" | "solid";
  from: string;
  to?: string;
}

export const CARD_TEMPLATES: CardTemplate[] = [
  { id: "dark", label: "다크", kind: "gradient", from: "#0b1215", to: "#1b2735" },
  { id: "ink-blue", label: "잉크→블루", kind: "gradient", from: "#0b1215", to: "#0067b7" },
  { id: "light", label: "라이트", kind: "gradient", from: "#fafaf6", to: "#e7e9f3" },
  { id: "canvas", label: "캔버스", kind: "solid", from: "#fafaf6" },
];

export const DEFAULT_CARD_TEMPLATE = "dark";

export const cardTemplate = (id: string | undefined): CardTemplate =>
  CARD_TEMPLATES.find((t) => t.id === id) ?? CARD_TEMPLATES[0];

/** Resolve a localized string for a language, with sensible fallback. */
export function pickText(t: LocalizedText | undefined, lang: Language): string {
  if (!t) return "";
  return t[lang] ?? t.ko ?? t.en ?? t.ja ?? "";
}
