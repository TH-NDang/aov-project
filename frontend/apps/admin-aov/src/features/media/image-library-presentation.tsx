import { useState } from "react"
import { CircleAlert, CircleCheck, ImageIcon, ImageOff } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import type { MediaCredit } from "@aov/ui/lib/media-credit"
import { primarySource, sourceGap, sourceGapHints, sourceGapLabels } from "./media-source-gaps"

export function LibraryImage({ url, className }: { url: string | null; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const failed = !!url && failedUrl === url
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/30",
        className,
      )}
    >
      {url && !failed ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-contain p-1"
          onError={() => setFailedUrl(url)}
        />
      ) : failed ? (
        <ImageOff aria-label="Không tải được ảnh" className="size-5 text-muted-foreground/60" />
      ) : (
        <ImageIcon aria-label="Chưa có ảnh" className="size-5 text-muted-foreground/60" />
      )}
    </span>
  )
}

export function LibraryCredit({
  sources,
  versionId,
  compact = false,
}: {
  sources?: MediaCredit[]
  versionId?: string | null
  compact?: boolean
}) {
  if (!versionId) return <span className="text-xs text-muted-foreground">Chờ hoàn tất upload</span>
  if (!sources) return <span className="text-xs text-muted-foreground">Chưa tải thông tin nguồn</span>
  const gap = sourceGap(sources)
  const source = primarySource(sources)
  return (
    <span className="block min-w-0 space-y-1" title={sourceGapHints[gap]}>
      <span
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium",
          gap === "none" ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400",
        )}
      >
        {gap === "none" ? (
          <CircleCheck aria-hidden className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <CircleAlert aria-hidden className="size-3.5 shrink-0" />
        )}
        <span className="truncate">{sourceGapLabels[gap]}</span>
      </span>
      {!compact && (
        <span className="block truncate text-xs text-muted-foreground" title={source?.label}>
          {source ? source.ownerName?.trim() || source.label : "Chưa có nguồn"}
        </span>
      )}
    </span>
  )
}

export function LibraryState({ state, label, ready }: { state: string; label: string; ready: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          !ready
            ? "bg-amber-500"
            : state === "ACTIVE"
              ? "bg-emerald-500"
              : state === "BLOCKED"
                ? "bg-destructive"
                : "bg-muted-foreground/50",
        )}
      />
      {ready ? label : "Chờ upload"}
    </span>
  )
}
