// Visual: editor-app UI mock — source shown inside an app window with a title bar
// and a prompt input bar (TapNow beat 2). Pairs with motion "shrink-into-ui".
import React from "react";
import { AbsoluteFill } from "remotion";
import type { VisualProps } from "@/remotion/ad/types";
import { SourceLayer } from "@/remotion/ad/components/SourceLayer";
import { CaptionBanner, BRAND_FALLBACK } from "@/remotion/ad/components/CaptionBanner";
import { COLORS } from "@/remotion/lib/util";

const dot = (c: string): React.CSSProperties => ({ width: 22, height: 22, borderRadius: 999, background: c });

export const Component: React.FC<VisualProps> = ({ page, product, assetBase }) => {
  const brand = product.brandColor || BRAND_FALLBACK;
  return (
    <AbsoluteFill style={{ background: "#11161c", justifyContent: "center", alignItems: "center" }}>
      {/* app window */}
      <div style={{ width: 880, borderRadius: 28, overflow: "hidden", background: "#1c232b", boxShadow: "0 30px 80px rgba(0,0,0,0.55)" }}>
        {/* title bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "22px 28px", background: "#242d37" }}>
          <div style={dot("#ff5f57")} />
          <div style={dot("#febc2e")} />
          <div style={dot("#28c840")} />
          <div style={{ marginLeft: 18, color: "#cdd6df", fontFamily: "Pretendard", fontWeight: 600, fontSize: 28 }}>
            {product.name} Studio
          </div>
        </div>
        {/* media area */}
        <div style={{ position: "relative", width: "100%", height: 1080, overflow: "hidden" }}>
          <SourceLayer source={page.source} assetBase={assetBase} />
        </div>
        {/* prompt input mock */}
        <div style={{ display: "flex", gap: 16, padding: "26px 28px", background: "#242d37", alignItems: "center" }}>
          <div style={{ flex: 1, background: "#11161c", borderRadius: 999, padding: "20px 30px", color: "#8b97a3", fontFamily: "Pretendard", fontWeight: 600, fontSize: 28, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
            {page.imagePrompt || "프롬프트를 입력하세요…"}
          </div>
          <div style={{ background: brand, color: "#fff", borderRadius: 999, padding: "20px 38px", fontFamily: "Pretendard", fontWeight: 900, fontSize: 28 }}>
            생성
          </div>
        </div>
      </div>
      <CaptionBanner text={page.caption} product={product} page={page} bottom={140} />
      <AbsoluteFill style={{ pointerEvents: "none", boxShadow: `inset 0 0 0 0 ${COLORS.ink}` }} />
    </AbsoluteFill>
  );
};
