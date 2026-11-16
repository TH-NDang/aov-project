import { Badge } from "@aov/ui/components/badge"
import type { MediaCredit } from "@aov/ui/lib/media-credit"
import { sourceGap, sourceGapHints, sourceGapLabels } from "./media-source-gaps"

export function MediaSourceStatus({ sources, versionId }: { sources?: MediaCredit[]; versionId?: string | null }) {
  if (!versionId) return <span className="text-xs text-muted-foreground">Chờ tải lên xong</span>
  if (!sources) return <span className="text-xs text-muted-foreground">Chưa tải thông tin nguồn</span>
  const gap = sourceGap(sources)
  return (
    <Badge
      variant="outline"
      title={sourceGapHints[gap]}
      className={
        gap === "none"
          ? "text-muted-foreground"
          : "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      }
    >
      {sourceGapLabels[gap]}
    </Badge>
  )
}
