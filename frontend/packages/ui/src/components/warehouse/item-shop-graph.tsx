import { useId, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  itemShopLayout,
  itemShopRowTracks,
  itemShopSections,
  type ItemShopPlacement,
} from "@aov/ui/lib/item-shop-layout"
import { itemEdges, selectedItemEdges } from "@aov/ui/lib/item-graph"
import { warehouseName, type WarehouseMetadata } from "@aov/ui/lib/warehouse-content"
import { Button } from "@aov/ui/components/button"
import { useWarehouseText } from "./warehouse-view"
import { DragGhost, GraphCard } from "./item-shop/graph-card"
import { RecipeWires, useRecipeWires } from "./item-shop/recipe-wires"
import { ShopColumn } from "./item-shop/shop-column"
import { ShopFilters } from "./item-shop/shop-filters"
import { ShopLegend } from "./item-shop/shop-legend"
import { columnWidth, positioned, type CardRegion, type Entry } from "./item-shop/shop-geometry"
import { useShopConnections } from "./item-shop/use-shop-connections"
import { useClearOnEmptyClick } from "./item-shop/use-clear-on-empty-click"

interface Props {
  items: Entry[]
  categories: WarehouseMetadata[]
  locale: string
  selectedId: string | null
  category: string
  onCategory: (code: string) => void
  onSelect: (id: string) => void
  onFocus: (id: string | null) => void
  onConnect?: (from: string, to: string) => void
  onMove?: (id: string, positionIndex: number, row: number, column: number) => void
  editable: boolean
  /** Items matching the page search; other cards are dimmed. Null when not searching. */
  matches?: ReadonlySet<string> | null
  /** Empty rows added below the group so items can be dropped further down; the page header adds them. */
  extraRows?: number
  onExtraRowsChange?: (rows: number) => void
  /** False when selecting a card is already enough to read it. */
  showOpenButton?: boolean
  /** Names for the columns, left to right, in place of their numbers. */
  columnLabels?: readonly string[]
  /** A tool at the end of the group row, such as a filter. */
  toolbar?: ReactNode
}

/**
 * The shop of one item category as the game lays it out: a column per tier, the selected item's recipe drawn as
 * wires. In Admin cards are dragged to other cells and linked by their ports.
 */
export function ItemShopGraph({
  items,
  categories,
  locale,
  selectedId,
  category,
  onCategory,
  onSelect,
  onFocus,
  onConnect,
  onMove,
  editable,
  matches = null,
  extraRows: more = 0,
  onExtraRowsChange: setMore = () => {},
  showOpenButton = true,
  columnLabels,
  toolbar,
}: Props) {
  const t = useWarehouseText()
  const [variant, setVariant] = useState("")
  const [dragging, setDragging] = useState<string | null>(null)
  const canvas = useRef<HTMLDivElement>(null)
  const scrollArea = useRef<HTMLDivElement>(null)
  const marker = useId().replaceAll(":", "")
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const layout = useMemo(
    () => itemShopLayout(items, selectedId, category, variant),
    [items, selectedId, category, variant],
  )
  const { placements, external } = layout
  const missingIcons = items.filter(
    (item) =>
      !item.content.iconAssetId && item.content.shopPositions.some((position) => position.categoryCode === category),
  )
  const variants = [
    ...new Set(
      items.flatMap((item) =>
        item.content.shopPositions
          .filter((p) => p.categoryCode === category)
          .map((p) => p.variant)
          .filter((v): v is string => !!v),
      ),
    ),
  ]
  const columns = Math.max(
    3,
    ...[...placements, ...external].filter((p) => positioned(p.position)).map((p) => p.position!.column! + 1),
  )
  const sectionsByColumn = useMemo(
    () => Array.from({ length: columns }, (_, column) => itemShopSections(placements, column)),
    [columns, placements],
  )
  const rowTracks = itemShopRowTracks(sectionsByColumn, more)
  const edges = useMemo(() => selectedItemEdges(itemEdges(items), selectedId), [items, selectedId])
  const related = new Set(edges.flatMap((edge) => [edge.from, edge.to]))

  const connections = useShopConnections({ canvas, scrollArea, onConnect })
  const { armed, setArmed, cancelConnection, suppressClick } = connections
  const paths = useRecipeWires({
    canvas,
    edges,
    byId,
    locale,
    placements,
    external,
    extraRows: more,
    onReset: cancelConnection,
  })
  useClearOnEmptyClick(scrollArea, connections, onFocus)

  function startDrag(event: DragStartEvent) {
    setDragging((event.active.data.current as { itemId: string } | undefined)?.itemId ?? null)
  }
  function endDrag(event: DragEndEvent) {
    setDragging(null)
    suppressClick.current = Date.now() + 300
    const from = event.active.data.current as { itemId: string; index: number } | undefined
    const to = event.over?.data.current as { row: number; column: number } | undefined
    if (from && to) onMove?.(from.itemId, from.index, to.row, to.column)
  }
  const card = (placement: ItemShopPlacement, region: CardRegion, column: number) => (
    <GraphCard
      key={`${placement.item.id}:${placement.index}`}
      item={placement.item}
      index={placement.index}
      editable={editable}
      locked={placement.item.revision.state !== "DRAFT"}
      selected={placement.item.id === selectedId}
      related={related.has(placement.item.id)}
      locale={locale}
      onSelect={() => onFocus(selectedId === placement.item.id ? null : placement.item.id)}
      onOpen={() => onSelect(placement.item.id)}
      column={column}
      columns={columns}
      armed={armed}
      onPort={connections.portClick}
      terminal={placement.terminal}
      region={region}
      dimmed={!!matches && !matches.has(placement.item.id)}
      showOpenButton={showOpenButton}
    />
  )

  return (
    <section className="min-w-0 space-y-3" aria-label={t("Sơ đồ trang bị", "Equipment shop")}>
      <ShopFilters
        items={items}
        categories={categories}
        locale={locale}
        category={category}
        matches={matches}
        editable={editable}
        missingIcons={missingIcons}
        variants={variants}
        variant={variant}
        toolbar={toolbar}
        onCategory={(code) => {
          // The category change comes last: both can write to the URL, and it also clears the selection.
          onFocus(null)
          onCategory(code)
          setVariant("")
          setMore(0)
        }}
        onVariant={setVariant}
        onSelect={onSelect}
      />
      <DndContext
        sensors={sensors}
        autoScroll={{ threshold: { x: 0.12, y: 0.15 }, acceleration: 18 }}
        onDragStart={startDrag}
        onDragEnd={endDrag}
        onDragCancel={() => {
          setDragging(null)
          suppressClick.current = Date.now() + 300
        }}
      >
        <div className="relative">
          <ShopLegend
            linkingFrom={armed ? warehouseName(byId.get(armed.id)!, locale) : null}
            selectedId={selectedId}
            showOpenButton={showOpenButton}
            onSelect={onSelect}
            onFocus={onFocus}
          />
          <div
            ref={scrollArea}
            className="shop-viewport overflow-x-auto"
            tabIndex={0}
            aria-label={t("Bảng vị trí trang bị", "Item positions")}
            onKeyDown={(event) => {
              if ((event.target as Element).closest("[data-item-region-help]")) return
              if (event.key === "Escape") {
                cancelConnection()
                if (armed) setArmed(null)
                else onFocus(null)
              }
            }}
          >
            <div
              ref={canvas}
              className="relative p-[var(--shop-padding,28px)] [contain:layout_paint]"
              style={{
                minWidth: `calc(${columns} * ${columnWidth} + ${columns - 1} * var(--shop-gap, 48px) + 2 * var(--shop-padding, 28px))`,
              }}
              {...connections.canvasHandlers}
            >
              <div
                className="grid justify-center gap-x-[var(--shop-gap,48px)] gap-y-2"
                style={{ gridTemplateColumns: `repeat(${columns}, ${columnWidth})` }}
              >
                {sectionsByColumn.map((sections, column) => (
                  <ShopColumn
                    key={column}
                    column={column}
                    label={columnLabels?.[column]}
                    sections={sections}
                    placements={placements}
                    external={external}
                    rowTracks={rowTracks}
                    extraRows={more}
                    categories={categories}
                    byId={byId}
                    selectedId={selectedId}
                    locale={locale}
                    renderCard={(placement, region) => card(placement, region, column)}
                  />
                ))}
              </div>
              <RecipeWires paths={paths} marker={marker} preview={connections.preview} onFocus={onFocus} />
            </div>
          </div>
        </div>
        {editable &&
          createPortal(
            <DragOverlay dropAnimation={null}>
              {dragging && byId.get(dragging) ? <DragGhost item={byId.get(dragging)!} locale={locale} /> : null}
            </DragOverlay>,
            document.body,
          )}
      </DndContext>
      {layout.unplaced.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">{t("Chưa xếp ô", "Unplaced items")}</span>
          {layout.unplaced.map((item) => (
            <Button key={item.id} size="sm" variant="outline" onClick={() => onSelect(item.id)}>
              {warehouseName(item, locale)}
              {item.revision.state === "PUBLISHED" && !item.revision.effectiveFromPatchVariantId && (
                <span className="type-meta">{t("Chưa rõ patch", "Patch unknown")}</span>
              )}
            </Button>
          ))}
        </div>
      )}
      {!!layout.missingIds.length && (
        <p role="status" className="text-xs text-muted-foreground">
          {layout.missingIds.length}{" "}
          {t(
            "nguyên liệu hoặc món nâng cấp chưa có dữ liệu tại phạm vi đang xem.",
            "ingredients or upgrades have no data in the scope being viewed.",
          )}
        </p>
      )}
    </section>
  )
}
