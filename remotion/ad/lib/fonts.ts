// Title/caption font registry. Pretendard is loaded locally (remotion/lib/fonts.ts);
// the rest come from @remotion/google-fonts, loaded lazily on first use (only the font a
// page actually picks downloads). Returns the resolved CSS font-family for a font key.
import { loadFont as blackHanSans } from "@remotion/google-fonts/BlackHanSans";
import { loadFont as jua } from "@remotion/google-fonts/Jua";
import { loadFont as doHyeon } from "@remotion/google-fonts/DoHyeon";
import { loadFont as gothicA1 } from "@remotion/google-fonts/GothicA1";
import { loadFont as nanumMyeongjo } from "@remotion/google-fonts/NanumMyeongjo";
import { loadFont as nanumPen } from "@remotion/google-fonts/NanumPenScript";
import { loadFont as bebasNeue } from "@remotion/google-fonts/BebasNeue";
import { loadFont as montserrat } from "@remotion/google-fonts/Montserrat";

type Loader = () => { fontFamily: string };

// key (stored on the page) → google-fonts loader. "Pretendard" stays local (no loader).
const LOADERS: Record<string, Loader> = {
  "Black Han Sans": blackHanSans,
  Jua: jua,
  "Do Hyeon": doHyeon,
  "Gothic A1": gothicA1,
  "Nanum Myeongjo": nanumMyeongjo,
  "Nanum Pen Script": nanumPen,
  "Bebas Neue": bebasNeue,
  Montserrat: montserrat,
};

const cache: Record<string, string> = {};

/** Resolve a font key to a loaded CSS font-family (defaults to Pretendard). */
export function fontFamily(key?: string): string {
  if (!key || key === "Pretendard") return "Pretendard";
  const loader = LOADERS[key];
  if (!loader) return "Pretendard";
  if (!cache[key]) cache[key] = loader().fontFamily; // idempotent — memoized by the lib
  return cache[key];
}
