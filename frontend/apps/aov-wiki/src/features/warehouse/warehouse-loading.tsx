import "./warehouse-page.css"
import { useParams, useSearchParams } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { NARROW_ITEM_LAYOUT, preferredItemLayout, useMediaQuery, type ItemLayout } from "./warehouse-layout"
import { warehouseKind, type WarehouseKind } from "../../lib/warehouse-types"

/** How many placeholders stand in for each catalog, close to what its first screen holds. */
const PLACEHOLDERS: Record<WarehouseKind, number> = { items: 15, enchantments: 4, arcana: 18, spells: 9 }

/**
 * The catalog's place while it loads, in the grid its entries will take: the board's three columns under its hint
 * line, or the list and the arcana under the heading of their first group.
 */
export function WarehouseSkeleton({ kind, layout }: { kind: WarehouseKind; layout: ItemLayout }) {
  const { locale } = useWikiContext()
  const itemLayout = kind === "items" ? layout : undefined
  const heading = kind === "arcana" || itemLayout === "list"
  return (
    <div
      className="wiki-warehouse-skeleton"
      data-kind={kind}
      data-layout={itemLayout}
      aria-label={wikiText(locale, "Đang tải kho trang bị", "Loading armory")}
      role="status"
    >
      {heading && <span className="wiki-warehouse-skeleton-heading wiki-skeleton" aria-hidden="true" />}
      {Array.from({ length: PLACEHOLDERS[kind] }, (_, index) => (
        <span className="wiki-skeleton" key={index} aria-hidden="true" />
      ))}
    </div>
  )
}

/** Shown while the page's code arrives: the head, the search and the catalog each already in place. */
export function WarehouseRouteLoading() {
  const kind = warehouseKind(useParams().tab ?? null)
  const [params] = useSearchParams()
  const layout = preferredItemLayout(params.get("layout"), useMediaQuery(NARROW_ITEM_LAYOUT))
  const wide = usePageLayout() === "wide"
  return (
    <div className={`wiki-warehouse-page wiki-warehouse-${kind}`} aria-busy="true">
      {wide ? (
        <div className="wiki-warehouse-loading-heading wiki-skeleton" />
      ) : (
        <div className="wiki-warehouse-version" />
      )}
      <div className="wiki-warehouse-controls">
        <div className="wiki-warehouse-toolbar">
          <span className="wiki-warehouse-search wiki-skeleton" />
        </div>
        {/* Holds the line the filters of this catalog will take. */}
        {kind !== "spells" && (kind === "items" || !wide) && <div className="wiki-warehouse-subbar" />}
      </div>
      <div className="wiki-warehouse-main">
        <WarehouseSkeleton kind={kind} layout={layout} />
      </div>
    </div>
  )
}
