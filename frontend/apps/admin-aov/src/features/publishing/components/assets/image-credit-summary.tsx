import { useQueries } from "@tanstack/react-query"
import { CircleAlert, Copyright } from "lucide-react"
import { currentMediaSources } from "@aov/ui/lib/media-credit"
import { cn } from "@aov/ui/lib/utils"
import { heroContentAssetQuery } from "../../model/assets/hero-content-asset"
import { primarySource, sourceGap, visibleSources } from "../../../media/media-source-gaps"

const shownOwners = 3

/**
 * Who owns a group of images and how many still lack a source or owner. It reads the same cached asset queries as the
 * thumbnails, so it adds no requests.
 */
export function ImageCreditSummary({
  label,
  assetIds,
  className,
}: {
  /** Names the image group in the UI language, e.g. skin art. */
  label: string
  assetIds: readonly (string | null | undefined)[]
  className?: string
}) {
  const ids = [...new Set(assetIds.filter((id): id is string => !!id))]
  const assets = useQueries({ queries: ids.map((id) => heroContentAssetQuery(id)) })
  const loaded = assets.flatMap((asset) => (asset.data?.currentUrl ? [asset.data] : []))
  if (!loaded.length) return null

  const owners = new Map<string, number>()
  let missing = 0
  for (const asset of loaded) {
    const sources = visibleSources(currentMediaSources(asset.provenance ?? [], asset.currentVersionId))
    const owner = sourceGap(sources) === "none" ? primarySource(sources)?.ownerName?.trim() : undefined
    if (owner) owners.set(owner, (owners.get(owner) ?? 0) + 1)
    else missing++
  }
  const ranked = [...owners].sort((a, b) => b[1] - a[1])

  return (
    <div
      role="note"
      aria-label={`Bản quyền ${label}`}
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted/40 px-3 py-2 text-sm", className)}
    >
      <span className="type-meta">
        Bản quyền {label} · {loaded.length} ảnh
      </span>
      {ranked.slice(0, shownOwners).map(([owner, count]) => (
        <span key={owner} className="inline-flex min-w-0 items-center gap-1.5">
          <Copyright aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="font-medium break-words">{owner}</span>
          {ranked.length > 1 && <span className="type-meta tabular-nums">{count}</span>}
        </span>
      ))}
      {ranked.length > shownOwners && <span className="type-meta">+{ranked.length - shownOwners} chủ sở hữu khác</span>}
      {missing > 0 && (
        <span className="inline-flex items-center gap-1.5 text-(--aov-warning)">
          <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
          {missing} ảnh chưa đủ nguồn hoặc chủ sở hữu
        </span>
      )}
    </div>
  )
}
