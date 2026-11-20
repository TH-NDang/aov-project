import { Fragment, type ReactNode } from "react"
import type { ItemShopLayout, ItemShopPlacement, ItemShopSection } from "@aov/ui/lib/item-shop-layout"
import { warehouseName, warehouseText, type WarehouseMetadata } from "@aov/ui/lib/warehouse-content"
import { useWarehouseText } from "../warehouse-view"
import { ItemShopRegionHelp } from "../item-shop-region-help"
import { GraphCell } from "./graph-card"
import { positioned, type CardRegion, type Entry } from "./shop-geometry"

/**
 * One column of the board: its label, its rows (complete items grouped in a band of their own), the empty rows added
 * below, then the items of other categories that this column's items build from or into.
 */
export function ShopColumn({
  column,
  label,
  sections,
  placements,
  external,
  rowTracks,
  extraRows,
  categories,
  byId,
  selectedId,
  locale,
  renderCard,
}: {
  column: number
  /** The column's name; its number when left out. */
  label?: string
  sections: ItemShopSection[]
  placements: ItemShopLayout["placements"]
  external: ItemShopLayout["external"]
  rowTracks: number[]
  extraRows: number
  categories: WarehouseMetadata[]
  byId: Map<string, Entry>
  selectedId: string | null
  locale: string
  renderCard: (placement: ItemShopPlacement, region: CardRegion) => ReactNode
}) {
  const t = useWarehouseText()
  const lastTrack = rowTracks.at(-1)!
  const native = placements.filter((p) => p.position.column === column && positioned(p.position))
  const nextRow = sections.at(-1)!.rows.at(-1)!.row + 1
  const references = external.filter((p) => p.position?.column === column && positioned(p.position))
  const groups = [...new Set(references.map((p) => p.categoryCode))]
  return (
    <section
      aria-label={label ?? `${t("Cột", "Column")} ${column + 1}`}
      data-shop-column={column}
      className="grid min-w-0 grid-rows-subgrid"
      style={{ gridColumn: column + 1, gridRow: `1 / span ${lastTrack + Number(groups.length > 0)}` }}
    >
      <h3 className="shop-column-label sticky top-0 z-10 mx-auto flex w-fit items-center gap-1.5 self-start rounded-full border bg-card px-3 py-0.5 text-xs font-semibold">
        {label ?? `${t("Cột", "Column")} ${column + 1}`}
        <span className="font-normal tabular-nums text-muted-foreground">
          {new Set(native.map((p) => p.item.id)).size} {t("món", "items")}
        </span>
      </h3>
      {sections.map((section) => {
        const firstRow = section.rows[0].row
        const lastRow = section.rows.at(-1)!.row
        const cells = section.rows.map(({ row, placements }) => (
          <GraphCell
            key={row}
            row={row}
            column={column}
            track={section.terminal ? rowTracks[row] - rowTracks[firstRow] + 2 : rowTracks[row]}
          >
            {placements.map((placement) => renderCard(placement, section.terminal ? "completed" : "standard"))}
          </GraphCell>
        ))
        return section.terminal ? (
          <section
            key={firstRow}
            aria-label={t(
              `Trang bị hoàn chỉnh · Cột ${column + 1} · Hàng ${firstRow + 1}–${lastRow + 1}`,
              `Complete items · Column ${column + 1} · Rows ${firstRow + 1}–${lastRow + 1}`,
            )}
            className="grid min-w-0 grid-rows-subgrid rounded-xl bg-muted/25 ring-1 ring-inset ring-border"
            style={{ gridRow: `${rowTracks[firstRow] - 1} / ${rowTracks[lastRow] + 1}` }}
          >
            <h4 className="flex items-center gap-1 px-2 pt-1 text-xs font-medium text-muted-foreground">
              {t("Trang bị hoàn chỉnh", "Complete items")}
              <ItemShopRegionHelp kind="terminal" />
            </h4>
            {cells}
          </section>
        ) : (
          <Fragment key={firstRow}>{cells}</Fragment>
        )
      })}
      {Array.from({ length: extraRows }, (_, index) => (
        <GraphCell key={index} row={nextRow + index} column={column} track={rowTracks[nextRow + index]} />
      ))}
      {groups.length > 0 && (
        <div className="self-start space-y-3" style={{ gridRow: lastTrack + 1 }}>
          {groups.map((code) => {
            const group = categories.find((entry) => entry.code === code)
            const name = group ? warehouseText(group.translations, locale)?.name || code : code
            return (
              <section
                key={code ?? "unassigned"}
                aria-label={t(
                  `Thuộc tính khác · ${name || "Chưa phân loại"} · Cột ${column + 1}`,
                  `Other category · ${name || "Uncategorized"} · Column ${column + 1}`,
                )}
                className="space-y-3 border-t border-dashed pt-3"
              >
                <h4 className="flex flex-wrap items-center gap-x-2 px-1 text-xs">
                  <span className="font-semibold">{name || t("Chưa phân loại", "Uncategorized")}</span>
                  <span className="text-muted-foreground">{t("Thuộc tính khác", "Other category")}</span>
                  <ItemShopRegionHelp
                    kind="external"
                    sourceGroup={name || t("Chưa phân loại", "Uncategorized")}
                    selectedItem={
                      byId.has(selectedId ?? "")
                        ? warehouseName(byId.get(selectedId!)!, locale)
                        : t("món đang chọn", "the selected item")
                    }
                  />
                </h4>
                {references
                  .filter((p) => p.categoryCode === code)
                  .map((p) =>
                    renderCard({ item: p.item, position: p.position!, index: p.index, terminal: false }, "external"),
                  )}
              </section>
            )
          })}
        </div>
      )}
    </section>
  )
}
