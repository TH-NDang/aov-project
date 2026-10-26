import { useState } from "react"
import { WikiImage } from "../../components/wiki-image"
import { WarehouseIcon } from "./warehouse-icon"
import { warehouseImage, type WarehouseEntry, type WarehouseKind } from "./warehouse-types"

export function WarehouseArtwork({
  entry,
  kind,
  assetId,
  className = "",
}: {
  entry: WarehouseEntry
  kind: WarehouseKind
  assetId?: string | null
  className?: string
}) {
  const source = warehouseImage(entry, assetId === undefined ? entry.content.iconAssetId : assetId)
  const [failedSource, setFailedSource] = useState<string>()

  return source && source !== failedSource ? (
    <WikiImage
      className={`wiki-warehouse-art ${className}`}
      src={source}
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
