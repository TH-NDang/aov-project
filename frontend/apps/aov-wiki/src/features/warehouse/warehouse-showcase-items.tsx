import { useMemo } from "react"
import { warehouseImage, type PublishedWarehouseRecord } from "../../lib/warehouse-types"
import { CatalogShowcase, type ShowcaseIntro } from "../../components/catalog-showcase"
import "./warehouse-showcase-items.css"

/** Rows of this many items, of which a band of this many rows repeats as the wall drifts. */
const WALL_COLUMNS = 16
const WALL_BAND = 4

/**
 * The items' head: the shop as a wall of every item's icon, laid back in perspective like the floor of the shop and
 * drifting slowly past, the title across from it.
 */
export function ItemShowcase({ intro, entries }: { intro: ShowcaseIntro; entries: PublishedWarehouseRecord[] }) {
  const icons = useMemo(
    () => entries.flatMap((entry) => (entry.kind === "items" && warehouseImage(entry)) || []),
    [entries],
  )
  return <CatalogShowcase {...intro} scene={icons.length > 0 && <ShopWall icons={icons} />} />
}

function ShopWall({ icons }: { icons: string[] }) {
  // Two bands of the same rows, so the wall drifts by one band and starts again without a seam.
  const rows = WALL_BAND * 2
  return (
    <div className="wiki-items-wall">
      <div className="wiki-items-wall-plane">
        <div className="wiki-items-wall-track">
          {Array.from({ length: rows * WALL_COLUMNS }, (_, index) => {
            const row = Math.floor(index / WALL_COLUMNS) % WALL_BAND
            const url = icons[(row * WALL_COLUMNS + (index % WALL_COLUMNS)) % icons.length]!
            return (
              <span key={index} className="wiki-items-wall-tile">
                <img src={url} alt="" loading="lazy" decoding="async" />
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
