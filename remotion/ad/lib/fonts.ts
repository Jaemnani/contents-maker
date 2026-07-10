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
import { loadFont as elmsSans } from "@remotion/google-fonts/ElmsSans";
import { loadFont as nanumGothic } from "@remotion/google-fonts/NanumGothic";
import { loadFont as notoSansKR } from "@remotion/google-fonts/NotoSansKR";
import { loadFont as gugi } from "@remotion/google-fonts/Gugi";
import { loadFont as gaegu } from "@remotion/google-fonts/Gaegu";
import { loadFont as gamjaFlower } from "@remotion/google-fonts/GamjaFlower";
import { loadFont as songMyung } from "@remotion/google-fonts/SongMyung";
import { loadFont as gowunDodum } from "@remotion/google-fonts/GowunDodum";
import { loadFont as gowunBatang } from "@remotion/google-fonts/GowunBatang";
import { loadFont as poorStory } from "@remotion/google-fonts/PoorStory";
import { loadFont as yeonSung } from "@remotion/google-fonts/YeonSung";
import { loadFont as stylish } from "@remotion/google-fonts/Stylish";
import { loadFont as singleDay } from "@remotion/google-fonts/SingleDay";
import { loadFont as eastSeaDokdo } from "@remotion/google-fonts/EastSeaDokdo";
import { loadFont as hahmlet } from "@remotion/google-fonts/Hahmlet";

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
  "Elms Sans": elmsSans,
  "Nanum Gothic": nanumGothic,
  "Noto Sans KR": notoSansKR,
  Gugi: gugi,
  Gaegu: gaegu,
  "Gamja Flower": gamjaFlower,
  "Song Myung": songMyung,
  "Gowun Dodum": gowunDodum,
  "Gowun Batang": gowunBatang,
  "Poor Story": poorStory,
  "Yeon Sung": yeonSung,
  Stylish: stylish,
  "Single Day": singleDay,
  "East Sea Dokdo": eastSeaDokdo,
  Hahmlet: hahmlet,
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
