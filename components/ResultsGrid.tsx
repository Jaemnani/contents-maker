import type { GenResult, Modality, ModelEntry } from "@/lib/types";
import ResultCard from "@/components/ResultCard";

export default function ResultsGrid({
  results,
  contentType,
  modelsById,
  onRetry,
  busy,
}: {
  results: GenResult[];
  contentType: Modality;
  modelsById: Record<string, ModelEntry>;
  onRetry?: (model: string) => void;
  busy?: boolean;
}) {
  if (!results.length) return null;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {results.map((r) => {
        const m = modelsById[r.model];
        return (
          <ResultCard
            key={r.model}
            result={r}
            contentType={contentType}
            label={m?.label ?? r.model}
            provider={m?.provider ?? ""}
            onRetry={onRetry}
            busy={busy}
          />
        );
      })}
    </div>
  );
}
