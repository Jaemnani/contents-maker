// Client helper: rewrite a prompt via the sanitize route. Falls back to the original on failure.
import type { Language } from "@/lib/types";

export async function sanitizePrompt(prompt: string, language: Language): Promise<string> {
  try {
    const res = await fetch("/api/sanitize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, language }),
    });
    const data = await res.json();
    if (!res.ok || !data?.sanitized) return prompt;
    return data.sanitized as string;
  } catch {
    return prompt; // never block generation on a sanitize failure
  }
}
