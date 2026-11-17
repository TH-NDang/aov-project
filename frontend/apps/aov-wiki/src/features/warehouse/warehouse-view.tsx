import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import { TooltipProvider } from "@aov/ui/components/tooltip"
import { WarehouseViewProvider, type WarehouseImageProps } from "@aov/ui/components/warehouse/warehouse-view"
import { useWikiContext } from "../../context/wiki-context"
import { WikiImage } from "../../components/wiki-image"
import type { HeroMedia } from "../../lib/hero-api"
import { WarehouseIcon } from "./warehouse-icon"
import type { WarehouseEntry, WarehouseGroup, WarehouseKind } from "../../lib/warehouse-types"

const MediaContext = createContext<{ assets: Map<string, HeroMedia>; kind: WarehouseKind } | null>(null)

function PublishedAsset({ id, alt = "", className }: WarehouseImageProps) {
  const media = useContext(MediaContext)
  const src = id && media?.assets.get(id)?.currentVersion?.url
  const [failed, setFailed] = useState<string>()
  return src && src !== failed ? (
    <span className={`inline-grid place-items-center overflow-hidden ${className ?? ""}`}>
      <WikiImage src={src} alt={alt} style={{ objectFit: "contain" }} onError={() => setFailed(src)} />
    </span>
  ) : (
    <span
      className={`inline-grid place-items-center ${className ?? ""}`}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
    >
      <WarehouseIcon name={media?.kind ?? "items"} />
    </span>
  )
}

export function PublishedWarehouseView({
  entries,
  groups,
  kind,
  children,
}: {
  entries: WarehouseEntry[]
  groups: WarehouseGroup[]
  kind: WarehouseKind
  children: ReactNode
}) {
  const { locale } = useWikiContext()
  const value = useMemo(() => {
    const assets = new Map<string, HeroMedia>()
    for (const entry of entries) for (const [id, asset] of Object.entries(entry.media ?? {})) assets.set(id, asset)
    for (const group of groups)
      for (const asset of [group.icon, group.background]) if (asset) assets.set(asset.assetId, asset)
    return { assets, kind }
  }, [entries, groups, kind])
  return (
    <MediaContext.Provider value={value}>
      <WarehouseViewProvider Asset={PublishedAsset} language={locale}>
        <TooltipProvider>{children}</TooltipProvider>
      </WarehouseViewProvider>
    </MediaContext.Provider>
  )
}

export function warehouseViewGroups(groups: WarehouseGroup[]) {
  return groups.map((group) => ({
    ...group,
    iconAssetId: group.icon?.assetId ?? null,
    backgroundAssetId: group.background?.assetId ?? null,
  }))
}
