import { Badge } from "@aov/ui/components/badge"
import { needsMediaCredit, type MediaCredit } from "@aov/ui/lib/media-credit"

export function MediaSourceStatus({ sources, versionId }: { sources?: MediaCredit[]; versionId?: string | null }) {
  if (!versionId) return <span className="text-xs text-muted-foreground">Chờ hoàn tất upload</span>
  if (!sources) return <span className="text-xs text-muted-foreground">Chưa tải thông tin nguồn</span>
  const incomplete = needsMediaCredit(sources)
  return (
    <Badge
      variant="outline"
      className={
        incomplete ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "text-muted-foreground"
      }
    >
      {incomplete ? "Cần bổ sung nguồn / credit" : "Đã có nguồn & credit"}
    </Badge>
  )
}
