import { useState } from "react"
import { WikiImage } from "../../components/wiki-image"
import { WarehouseIcon } from "./warehouse-icon"
import { warehouseImage, type WarehouseEntry, type WarehouseKind } from "./warehouse-types"

export function WarehouseArtwork({
  entry,
  kind,
  assetId,
  className = "",
  showCredit = false,
}: {
  entry: WarehouseEntry
  kind: WarehouseKind
  assetId?: string | null
  className?: string
  showCredit?: boolean
}) {
  const source = warehouseImage(entry, assetId === undefined ? entry.content.iconAssetId : assetId)
  const [failedSource, setFailedSource] = useState<string>()

  return source && source !== failedSource ? (
    <WikiImage
      className={`wiki-warehouse-art ${className}`}
      src={source}
      media={showCredit ? entry.media?.[assetId ?? entry.content.iconAssetId ?? ""] : undefined}
      alt=""
      width="80"
      height="80"
      onError={() => setFailedSource(source)}
    />
  ) : (
    <span className={`wiki-warehouse-art wiki-warehouse-art-fallback ${className}`} aria-hidden="true">
      <WarehouseIcon name={kind} size={28} />
    </span>
  )
}
