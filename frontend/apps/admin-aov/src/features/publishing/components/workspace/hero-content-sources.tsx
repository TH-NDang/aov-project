import type { Source } from "@/lib/hero-types"
import { cn } from "@aov/ui/lib/utils"

export function HeroContentSources({ sources, compact = false }: { sources: Source[]; compact?: boolean }) {
  if (!sources.length) return null
  return (
    <details className={cn("type-meta border-t pt-3", compact ? "mt-3" : "mt-5")}>
      <summary className="cursor-pointer py-1">Nguồn & đối chiếu ({sources.length})</summary>
      <ul className="mt-3 space-y-2">
        {sources.map((source, index) => (
          <li key={index}>
            {source.sourceUrl && /^https?:\/\//i.test(source.sourceUrl) ? (
              <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                {source.label}
              </a>
            ) : (
              source.label
            )}
            {" · "}
            {source.verificationState === "VERIFIED" ? "Đã đối chiếu" : "Chưa đối chiếu"}
            {source.note && <p className="mt-1 break-words">{source.note}</p>}
          </li>
        ))}
      </ul>
    </details>
  )
}
