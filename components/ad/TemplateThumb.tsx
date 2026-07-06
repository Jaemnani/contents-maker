"use client";
// Schematic (CSS-only) preview of what each template looks like — no media needed.
// Visual: layout boxes (where image/title/caption sit). Motion/Transition: animated icon.
// Used in the page-add picker, the template pickers, and the inspector.
import React from "react";

// Keyframes (tt-zoom/pan/pop/shrink/slide/rotate/fade) live in app/globals.css — injected
// once globally instead of a <style> block per thumb instance.
const GRAD = "linear-gradient(150deg,#3b4a5a 0%,#1b2735 100%)";

/** Media stand-in: gradient + sun/hill so it reads as a photo. */
const Media: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <div style={{ position: "absolute", inset: 0, background: GRAD, overflow: "hidden", ...style }}>
    <div style={{ position: "absolute", top: "20%", left: "22%", width: "16%", height: 0, paddingBottom: "16%", borderRadius: "50%", background: "#ffd27a" }} />
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "42%", background: "#0b1215", clipPath: "polygon(0 60%,35% 18%,60% 55%,100% 22%,100% 100%,0 100%)" }} />
  </div>
);

const Bar: React.FC<{ pos: "top" | "bottom"; color: string; h?: string }> = ({ pos, color, h = "16%" }) => (
  <div style={{ position: "absolute", left: "12%", right: "12%", [pos]: "10%", height: h, borderRadius: 3, background: color }} />
);

function VisualThumb({ id, brand }: { id: string; brand: string }) {
  switch (id) {
    case "fullscreen-title":
      return (<><Media /><Bar pos="top" color={brand} h="13%" /></>);
    case "talking-head-caption":
      return (<><Media /><Bar pos="bottom" color="#fff" /></>);
    case "ui-demo-frame":
      return (
        <div style={{ position: "absolute", inset: "12%", borderRadius: 6, background: "#fff", boxShadow: "0 0 0 1px rgba(0,0,0,.15)", overflow: "hidden" }}>
          <div style={{ height: "16%", background: "#e6e8ec", display: "flex", alignItems: "center", gap: 2, paddingLeft: 3 }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => (<span key={c} style={{ width: 4, height: 4, borderRadius: "50%", background: c }} />))}
          </div>
          <div style={{ position: "relative", height: "62%" }}><Media /></div>
          <div style={{ margin: "8% 12%", height: "10%", borderRadius: 4, background: "#e6e8ec" }} />
        </div>
      );
    case "canvas-grid":
      return (
        <div style={{ position: "absolute", inset: 0, background: "#fafaf6", padding: "16%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {[0, 1, 2, 3].map((i) => (<div key={i} style={{ position: "relative", borderRadius: 3, overflow: "hidden" }}><Media /></div>))}
        </div>
      );
    case "model-selector":
      return (
        <><Media />
          <div style={{ position: "absolute", top: "14%", left: "14%", right: "14%", height: "14%", borderRadius: 4, background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px", fontSize: 6, color: "#0b1215" }}>
            <span>AI ▾</span>
          </div>
        </>
      );
    case "compare-2up":
      return (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg,#1b232e,#0a0e13)", padding: "10% 12%", display: "flex", flexDirection: "column", gap: "8%" }}>
          <div style={{ position: "relative", flex: 1, borderRadius: 4, overflow: "hidden" }}><Media /></div>
          <div style={{ position: "relative", flex: 1, borderRadius: 4, overflow: "hidden" }}><Media style={{ background: "linear-gradient(150deg,#5a3b4a,#35131f)" }} /></div>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", padding: "1px 4px", borderRadius: 3, background: brand, color: "#fff", fontSize: 5, fontWeight: 900, letterSpacing: 1 }}>VS</div>
        </div>
      );
    case "split-media-text":
      return (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ position: "relative", flex: "0 0 60%" }}><Media /></div>
          <div style={{ flex: 1, background: brand, display: "grid", placeItems: "center" }}>
            <div style={{ width: "62%", height: "16%", borderRadius: 2, background: "rgba(255,255,255,0.92)" }} />
          </div>
        </div>
      );
    case "quote-card":
      return (
        <><Media style={{ filter: "brightness(0.55)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
            <div style={{ color: brand, fontSize: 18, fontWeight: 900, lineHeight: 0.6 }}>“</div>
            <div style={{ width: "56%", height: "8%", borderRadius: 2, background: "#fff" }} />
            <div style={{ width: "30%", height: "5%", borderRadius: 2, background: "rgba(255,255,255,0.6)" }} />
          </div>
        </>
      );
    case "big-stat":
      return (
        <><Media style={{ filter: "brightness(0.4)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
            <span style={{ color: brand, fontWeight: 900, fontSize: 22, lineHeight: 1 }}>10x</span>
            <div style={{ width: "34%", height: "5%", borderRadius: 2, background: "rgba(255,255,255,0.85)" }} />
          </div>
        </>
      );
    case "before-after-slider":
      return (
        <div style={{ position: "absolute", inset: 0 }}>
          <Media />
          <div style={{ position: "absolute", inset: 0, clipPath: "inset(0 45% 0 0)" }}><Media style={{ background: "linear-gradient(150deg,#3b5a4a,#13351f)" }} /></div>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "55%", width: 2, background: "#fff" }} />
          <div style={{ position: "absolute", top: "50%", left: "55%", transform: "translate(-50%,-50%)", width: 10, height: 10, borderRadius: "50%", background: "#fff" }} />
        </div>
      );
    case "checklist-reveal":
      return (
        <><Media style={{ filter: "brightness(0.45)" }} />
          <div style={{ position: "absolute", inset: "18% 14%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ width: 6, height: 6, borderRadius: 2, background: brand, color: "#fff", fontSize: 4, lineHeight: "6px", textAlign: "center" }}>✓</span>
                <span style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.85)" }} />
              </div>
            ))}
          </div>
        </>
      );
    case "phone-mockup":
      return (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg,#1b232e,#0a0e13)", display: "grid", placeItems: "center" }}>
          <div style={{ position: "relative", width: "52%", height: "70%", borderRadius: 8, background: "#111826", padding: 2 }}>
            <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 6, overflow: "hidden" }}><Media /></div>
            <div style={{ position: "absolute", top: 3, left: "50%", transform: "translateX(-50%)", width: "36%", height: 3, borderRadius: 2, background: "#111826" }} />
          </div>
        </div>
      );
    case "plain-caption":
    default:
      return (<><Media /><Bar pos="bottom" color={brand} h="13%" /></>);
  }
}

function MotionThumb({ id }: { id: string }) {
  const anim = (name: string, dur = 1.6) => ({ animation: `${name} ${dur}s ease-in-out infinite` });
  if (id === "none") return <Media />;
  if (id === "ken-burns-zoom") return <div style={{ position: "absolute", inset: 0, ...anim("tt-zoom") }}><Media /></div>;
  if (id === "pan") return <div style={{ position: "absolute", inset: "-10%", ...anim("tt-pan") }}><Media /></div>;
  if (id === "shrink-into-ui") return <div style={{ position: "absolute", inset: 0, ...anim("tt-shrink", 2) }}><Media /></div>;
  if (id === "caption-pop")
    return (<><Media /><div style={{ position: "absolute", left: "20%", right: "20%", bottom: "16%", height: "16%", borderRadius: 3, background: "#fff", ...anim("tt-pop") }} /></>);
  if (id === "zoom-out") return <div style={{ position: "absolute", inset: 0, animation: "tt-shrink 2s ease-in-out infinite" }}><Media /></div>;
  if (id === "drift-up") return <div style={{ position: "absolute", inset: "-12%", animation: "tt-drifty 2.2s ease-in-out infinite" }}><Media /></div>;
  if (id === "rotate-in") return <div style={{ position: "absolute", inset: "-6%", ...anim("tt-rotate", 1.8) }}><Media /></div>;
  if (id === "pulse") return <div style={{ position: "absolute", inset: 0, animation: "tt-pulse 0.9s ease-in-out infinite" }}><Media /></div>;
  if (id === "shake") return <div style={{ position: "absolute", inset: "-6%", animation: "tt-shake 0.5s linear infinite" }}><Media /></div>;
  if (id === "parallax-float") return <div style={{ position: "absolute", inset: "-10%", animation: "tt-drifty 2.6s ease-in-out infinite" }}><Media /></div>;
  if (id === "whip-zoom-in") return <div style={{ position: "absolute", inset: 0, animation: "tt-whipzoom 1.6s ease-out infinite" }}><Media /></div>;
  return <Media />;
}

const Half: React.FC<{ c: string; label: string; style?: React.CSSProperties }> = ({ c, label, style }) => (
  <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: c, color: "#fff", fontSize: 9, fontWeight: 800, ...style }}>{label}</div>
);

function TransitionThumb({ id, brand }: { id: string; brand: string }) {
  if (id === "fade")
    return (<><Half c="#2b3a4a" label="A" /><div style={{ position: "absolute", inset: 0, animation: "tt-fade 1.4s ease-in-out infinite alternate" }}><Half c={brand} label="B" /></div></>);
  if (id === "slide")
    return (<><Half c="#2b3a4a" label="A" /><div style={{ position: "absolute", inset: 0, animation: "tt-slide 1.4s ease-in-out infinite alternate" }}><Half c={brand} label="B" /></div></>);
  if (id === "wipe")
    return (<><Half c="#2b3a4a" label="A" /><div style={{ position: "absolute", inset: 0, animation: "tt-fade 1.4s steps(2) infinite alternate", clipPath: "polygon(0 0,55% 0,45% 100%,0 100%)" }}><Half c={brand} label="B" /></div></>);
  if (id === "flip")
    return (<><Half c="#2b3a4a" label="A" /><div style={{ position: "absolute", inset: 0, animation: "tt-flip 1.6s ease-in-out infinite", transformOrigin: "center" }}><Half c={brand} label="B" /></div></>);
  if (id === "clock-wipe")
    return (<><Half c="#2b3a4a" label="A" /><div style={{ position: "absolute", inset: 0, animation: "tt-fade 1.6s ease-in-out infinite alternate", clipPath: "polygon(50% 50%, 50% 0, 100% 0, 100% 100%, 50% 100%)" }}><Half c={brand} label="B" /></div></>);
  if (id === "whip-pan")
    return (<><Half c="#2b3a4a" label="A" /><div style={{ position: "absolute", inset: 0, animation: "tt-whip 0.9s ease-in-out infinite alternate" }}><Half c={brand} label="B" /></div></>);
  if (id === "glitch")
    return (<><Half c="#2b3a4a" label="A" /><div style={{ position: "absolute", inset: 0, animation: "tt-glitch 0.6s steps(3) infinite" }}><Half c={brand} label="B" /></div></>);
  if (id === "push")
    return (<><div style={{ position: "absolute", inset: 0, animation: "tt-pushback 1.4s ease-in-out infinite alternate" }}><Half c="#2b3a4a" label="A" /></div><div style={{ position: "absolute", inset: 0, animation: "tt-slide 1.4s ease-in-out infinite alternate" }}><Half c={brand} label="B" /></div></>);
  if (id === "iris")
    return (<><Half c="#2b3a4a" label="A" /><div style={{ position: "absolute", inset: 0, animation: "tt-iris 1.5s ease-in-out infinite alternate" }}><Half c={brand} label="B" /></div></>);
  if (id === "diagonal-wipe")
    return (<><Half c="#2b3a4a" label="A" /><div style={{ position: "absolute", inset: 0, animation: "tt-fade 1.4s steps(2) infinite alternate", clipPath: "polygon(0 0,100% 0,0 100%)" }}><Half c={brand} label="B" /></div></>);
  if (id === "spin-zoom")
    return (<div style={{ position: "absolute", inset: 0, animation: "tt-spinzoom 1.3s ease-in-out infinite alternate" }}><Half c={brand} label="B" /></div>);
  if (id === "zoom-blur")
    return (<div style={{ position: "absolute", inset: 0, animation: "tt-zoom 1.4s ease-in-out infinite", filter: "blur(.5px)" }}><Half c={brand} label="B" /></div>);
  if (id === "dreamy-zoom")
    return (<div style={{ position: "absolute", inset: 0, animation: "tt-rotate 1.6s ease-in-out infinite alternate" }}><Half c={brand} label="B" /></div>);
  // cut
  return (<><div style={{ position: "absolute", inset: 0, right: "50%" }}><Half c="#2b3a4a" label="A" /></div><div style={{ position: "absolute", inset: 0, left: "50%" }}><Half c={brand} label="B" /></div></>);
}

export default function TemplateThumb({
  category,
  id,
  brand = "#ff5a1f",
  className = "w-10",
}: {
  category: "visual" | "motion" | "transition" | "endcard";
  id: string;
  brand?: string;
  className?: string;
}) {
  return (
    <div className={`relative aspect-[9/16] shrink-0 overflow-hidden rounded-md bg-ink ${className}`}>
      {category === "visual" && <VisualThumb id={id} brand={brand} />}
      {category === "motion" && <MotionThumb id={id} />}
      {category === "transition" && <TransitionThumb id={id} brand={brand} />}
      {category === "endcard" && <EndcardThumb id={id} brand={brand} />}
    </div>
  );
}

function EndcardThumb({ id, brand }: { id: string; brand: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "#fafaf6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5 }}>
      <div style={{ width: "46%", height: "12%", borderRadius: 3, background: "#0b1215", opacity: id === "logo-blur-in" ? undefined : 1, filter: id === "logo-blur-in" ? "blur(.6px)" : undefined }} />
      {id === "logo-cta" ? (
        <div style={{ width: "40%", height: "11%", borderRadius: 999, background: brand }} />
      ) : (
        <div style={{ width: "60%", height: "7%", borderRadius: 2, background: "rgba(11,18,21,.4)" }} />
      )}
    </div>
  );
}
