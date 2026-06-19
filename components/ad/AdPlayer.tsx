"use client";
// Single client-only Remotion Player wrapper (dynamic ssr:false keeps the generic
// component typing intact). Shared by the full preview + per-page/endcard mini previews.
import dynamic from "next/dynamic";
import type PlayerInner from "@/components/ad/PlayerInner";
import type React from "react";

const Inner = dynamic(() => import("@/components/ad/PlayerInner"), {
  ssr: false,
  loading: () => (
    <div className="grid aspect-[9/16] w-full place-items-center rounded-lg bg-ink/5 text-xs text-muted">
      플레이어 로딩…
    </div>
  ),
});

export default function AdPlayer(props: React.ComponentProps<typeof PlayerInner>) {
  return <Inner {...props} />;
}
