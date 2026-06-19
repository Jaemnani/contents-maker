// Load brand fonts for the render browser. delayRender() holds the frame until fonts are ready.
import { staticFile, delayRender, continueRender } from "remotion";

let loaded = false;

export function ensureFonts() {
  if (loaded || typeof document === "undefined") return;
  loaded = true;
  const defs: { family: string; file: string; weight: string }[] = [
    { family: "Pretendard", file: "Pretendard-Black.otf", weight: "900" },
    { family: "Pretendard", file: "Pretendard-SemiBold.otf", weight: "600" },
    { family: "Bebas Neue", file: "BebasNeue-Regular.ttf", weight: "400" },
  ];
  for (const d of defs) {
    const handle = delayRender(`font ${d.family} ${d.weight}`);
    const font = new FontFace(d.family, `url(${staticFile("fonts/" + d.file)})`, { weight: d.weight });
    font
      .load()
      .then((f) => {
        document.fonts.add(f);
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
  }
}
