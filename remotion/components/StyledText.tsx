import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import type { TextStyle } from "@/lib/composition-types";
import { textCss, type TextDefaults } from "../lib/style";

/** Overlay text with a TextStyle + a gentle rise/fade kinetic entrance. */
export const StyledText = ({
  text,
  style,
  def,
  delay = 0,
}: {
  text: string;
  style?: TextStyle;
  def: TextDefaults;
  delay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!text) return null;
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 16 });
  const y = interpolate(s, [0, 1], [24, 0]);
  const opacity = interpolate(frame, [delay, delay + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <div style={{ ...textCss(style, def), textAlign: "center", transform: `translateY(${y}px)`, opacity }}>{text}</div>;
};
