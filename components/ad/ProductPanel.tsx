"use client";
// Brand styling for the whole video. (Product name moved to page editing; one-liner/CTA
// live in the endcard; value-props moved to the script-input box near the top.)
import type { AdProduct } from "@/lib/ad/schema";

export default function ProductPanel({
  product,
  onProduct,
}: {
  product: AdProduct;
  onProduct: (p: AdProduct) => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-bold">브랜드</h2>
      <p className="mb-3 mt-0.5 text-[11px] leading-snug text-muted">영상 전체의 강조 색입니다. 자막 배너·배지·버튼·엔드카드 버튼에 쓰여요.</p>
      <div>
        <div className="mb-1 text-xs text-muted">브랜드 컬러</div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={product.brandColor || "#ff5a1f"}
            onChange={(e) => onProduct({ ...product, brandColor: e.target.value })}
            className="h-9 w-12 cursor-pointer rounded-md border border-border bg-surface"
          />
          <span className="text-xs text-muted">{product.brandColor || "#ff5a1f"}</span>
        </div>
      </div>
    </section>
  );
}
