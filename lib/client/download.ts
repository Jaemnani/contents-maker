// Small client-side download helpers.
import type { GenResult } from "@/lib/types";
import { TEXT_VARIANTS } from "@/lib/channels";

export function triggerDownload(filename: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadBlob(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  triggerDownload(filename, url);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function variantsToMarkdown(result: GenResult): string {
  const lines = [`# ${result.model}`, ""];
  const v = result.variants ?? {};
  for (const spec of TEXT_VARIANTS) {
    const item = v[spec.id];
    if (!item) continue;
    lines.push(`## ${spec.label} (${item.chars}자 → ${item.targetChannels.join(", ")})`, "", item.text, "");
  }
  if (!Object.keys(v).length && result.raw) lines.push(result.raw);
  return lines.join("\n");
}

export function downloadResult(result: GenResult, contentType: "text" | "image" | "video") {
  const safe = result.model.replace(/[/:]/g, "-");
  if (contentType === "text") {
    downloadBlob(`${safe}.md`, variantsToMarkdown(result), "text/markdown");
  } else if (contentType === "image") {
    (result.images ?? []).forEach((img) =>
      triggerDownload(`${safe}-${img.aspect.replace(":", "x")}.png`, img.dataUrl)
    );
  } else if (result.videoUrl) {
    // Remote cross-origin URL ignores the download attribute -> route through our proxy.
    const name = `${safe}.mp4`;
    triggerDownload(name, `/api/download?url=${encodeURIComponent(result.videoUrl)}&name=${encodeURIComponent(name)}`);
  }
}
