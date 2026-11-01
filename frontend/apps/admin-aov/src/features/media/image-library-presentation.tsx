import { useState } from "react"
import { CircleAlert, Copyright, ImageIcon, ImageOff, UserRound } from "lucide-react"
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

/** Who owns the image, or what is missing; the image list leads with this. */
export function LibraryOwner({
  sources,
  versionId,
  userImage = false,
}: {
  sources?: MediaCredit[]
  versionId?: string | null
  /** A user's own avatar, which needs no owner. */
  userImage?: boolean
}) {
  if (!versionId) return <span className="type-meta">Chờ hoàn tất upload</span>
  if (userImage)
    return (
      <span className="type-meta flex min-w-0 items-center gap-1.5" title="Ảnh đại diện không cần ghi chủ sở hữu.">
        <UserRound aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">Ảnh người dùng tải lên</span>
      </span>
    )
  if (!sources) return <span className="type-meta">Chưa tải thông tin nguồn</span>
  const gap = sourceGap(sources)
  const owner = primarySource(sources)?.ownerName?.trim()
  return gap === "none" && owner ? (
    <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium" title={owner}>
      <Copyright aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{owner}</span>
    </span>
  ) : (
    <span
      className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400"
      title={sourceGapHints[gap]}
    >
      <CircleAlert aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">{sourceGapLabels[gap]}</span>
    </span>
  )
}

/** Where the image came from, shown next to its owner. */
export function LibrarySource({ sources, className }: { sources?: MediaCredit[]; className?: string }) {
  const source = primarySource(sources ?? [])
  return (
    <span className={cn("block truncate text-xs text-muted-foreground", className)} title={source?.label}>
      {source?.label || "Chưa có nguồn"}
    </span>
  )
}

/** Only states worth noticing get a badge; an active, uploaded image shows nothing. */
export function LibraryStateBadge({ state, label, ready }: { state: string; label: string; ready: boolean }) {
  if (ready && state === "ACTIVE") return null
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-1.5 text-xs leading-5",
        !ready
          ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
          : state === "BLOCKED"
            ? "border-destructive/40 text-destructive"
            : "text-muted-foreground",
      )}
    >
      {ready ? label : "Chờ upload"}
    </span>
  )
}
