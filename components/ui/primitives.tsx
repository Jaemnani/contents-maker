"use client";
// Minimal UI primitives encoding the DESIGN.md visual contract (tokens + motion).
// No Base UI / framer-motion deps — Tailwind v4 tokens + transitions (200ms ease-out-quint).
import type { ButtonHTMLAttributes, ReactNode } from "react";

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
type BtnSize = "sm" | "md" | "lg";

const BTN_VARIANT: Record<BtnVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-dark",
  secondary: "bg-surface text-ink border border-border hover:border-empathy",
  ghost: "bg-surface-muted text-ink hover:bg-border",
  danger: "bg-danger text-white hover:brightness-95",
};
const BTN_SIZE: Record<BtnSize, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3.5 py-2 text-sm",
  lg: "px-5 py-2.5 text-[15px]",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-semibold transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${BTN_VARIANT[variant]} ${BTN_SIZE[size]} ${className}`}
    />
  );
}

type BadgeVariant = "default" | "empathy" | "eli5" | "success" | "warning" | "danger";
const BADGE: Record<BadgeVariant, string> = {
  default: "bg-surface text-muted border border-border",
  empathy: "bg-primary text-white",
  eli5: "bg-eli5-light text-eli5-dark",
  success: "bg-eli5-light text-eli5-dark",
  warning: "bg-accent text-ink",
  danger: "bg-danger text-white",
};

export function Badge({ variant = "default", className = "", children }: { variant?: BadgeVariant; className?: string; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE[variant]} ${className}`}>{children}</span>;
}

type CardSize = "sm" | "md" | "lg" | "xl";
const CARD: Record<CardSize, string> = {
  sm: "rounded-md p-3",
  md: "rounded-lg p-4",
  lg: "rounded-xl p-5",
  xl: "rounded-2xl p-6",
};

export function Card({
  size = "md",
  className = "",
  children,
}: {
  size?: CardSize;
  className?: string;
  children: ReactNode;
}) {
  return <div className={`border border-border bg-surface ${CARD[size]} ${className}`}>{children}</div>;
}

/** Shared input/select/textarea styling (16px to dodge iOS auto-zoom; primary focus ring). */
export const inputCls =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50";

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`text-xs font-medium text-muted ${className}`}>{children}</span>;
}
