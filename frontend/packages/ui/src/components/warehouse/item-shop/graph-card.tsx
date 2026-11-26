import { useId, useLayoutEffect, useMemo, useRef, type ReactNode } from "react"
import { useDraggable, useDroppable } from "@dnd-kit/core"
import { Circle, GripVertical, ImageOff, PanelRightOpen } from "lucide-react"
import { itemCardStats, itemReaderContent } from "@aov/ui/lib/item-description"
import { cn } from "@aov/ui/lib/utils"
import { warehouseName, warehouseText } from "@aov/ui/lib/warehouse-content"
import { Button } from "@aov/ui/components/button"
import {
  cardChangeKinds,
  useWarehouseText,
  WarehouseAsset as HeroAsset,
  WarehouseBadges as CatalogChangeBadges,
} from "../warehouse-view"
import { itemCategoryFallback } from "../item-category-icon"
import { ItemStatChips } from "../item-facts"
import { ItemPrice } from "../item-price"
import { columnWidth, type CardRegion, type Entry, type Port } from "./shop-geometry"

/** A name or summary that takes the smaller size when it would not fit its lines. */
function ShopCardText({ text, summary = false }: { text: string; summary?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const label = ref.current
    if (!label) return
    let width = 0
    const fit = () => {
      width = label.clientWidth
      label.removeAttribute("data-condensed")
      if (label.scrollHeight > label.clientHeight + 1) label.setAttribute("data-condensed", "")
    }
    fit()
    const resize = new ResizeObserver(() => {
      if (width !== label.clientWidth) fit()
    })
    resize.observe(label)
    document.fonts?.addEventListener("loadingdone", fit)
    return () => {
      resize.disconnect()
      document.fonts?.removeEventListener("loadingdone", fit)
    }
  }, [text])
  return (
    <span
      ref={ref}
      title={text}
      className={cn(
        "text-sm leading-tight break-words data-[condensed]:text-xs data-[condensed]:leading-tight",
        summary ? "shop-item-summary line-clamp-3 text-muted-foreground" : "line-clamp-2 font-semibold",
      )}
    >
      {text}
    </span>
  )
}

/** One item on the board: its picture and price, name, stats and state, with ports to link recipes. */
export function GraphCard({
  item,
  index,
  selected,
  related,
  editable,
  locale,
  onSelect,
  onOpen,
  column,
  columns,
  armed,
  onPort,
  terminal = false,
  region,
  locked = false,
  dimmed = false,
  showOpenButton = true,
}: {
  item: Entry
  index: number
  selected: boolean
  related: boolean
  editable: boolean
  locale: string
  onSelect: () => void
  onOpen: () => void
  column: number
  columns: number
  armed: Port | null
  onPort: (port: Port) => void
  terminal?: boolean
  region: CardRegion
  /** Published, not a draft. Published items stay movable; the page asks to create a draft when one is changed. */
  locked?: boolean
  /** Does not match the current search. */
  dimmed?: boolean
  showOpenButton?: boolean
}) {
  const t = useWarehouseText()
  const reference = region === "external"
  const drag = useDraggable({
    id: `${item.id}:${index}`,
    data: { itemId: item.id, index },
    disabled: !editable || reference,
  })
  const name = warehouseName(item, locale)
  const text = warehouseText(item.content.translations, locale)
  const summary = text?.summary?.trim()
  const stats = useMemo(
    () => itemCardStats(itemReaderContent(item.content, text, locale)),
    [item.content, text, locale],
  )
  const changeKinds = cardChangeKinds(item.changeKinds)
  const hasOutput = column < columns - 1 && !terminal
  const missing = item.missingFields?.length ?? 0
  const Fallback = itemCategoryFallback(item.content.categoryCode)
  return (
    <div
      ref={drag.setNodeRef}
      data-item-node={item.id}
      data-shop-reference={reference || undefined}
      className={cn(
        "group/card relative flex min-h-20 w-full min-w-0 items-center gap-1 rounded-xl border bg-card p-2 transition-shadow hover:shadow-sm",
        column > 0 && "pl-7",
        hasOutput && "pr-7",
        selected ? "border-primary ring-2 ring-primary/20" : related ? "border-primary/40" : "",
        reference && "border-dashed bg-card/70",
        dimmed && !selected && "opacity-35 saturate-50 hover:opacity-100 hover:saturate-100",
        drag.isDragging && "opacity-40",
      )}
    >
      {editable && !reference && (
        <button
          type="button"
          aria-label={t(`Di chuyển ${name}`, `Move ${name}`)}
          title={t("Kéo để đổi ô", "Drag to another cell")}
          className="relative z-10 cursor-grab touch-none self-stretch text-muted-foreground opacity-0 transition-opacity group-hover/card:opacity-100 hover:text-foreground focus-visible:opacity-100 active:cursor-grabbing [@media(hover:none)]:opacity-100"
          {...drag.listeners}
          {...drag.attributes}
        >
          <GripVertical className="size-3.5" />
        </button>
      )}
      <button
        type="button"
        // Its overlay stretches over the whole card, so a click anywhere on the card selects the item.
        className="shop-item-select group flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-2 focus-visible:outline-ring"
        // A second click on the chosen card opens it: the first one shows its recipe on the board.
        onClick={selected && showOpenButton ? onOpen : onSelect}
        onDoubleClick={showOpenButton ? onOpen : undefined}
        title={
          selected && showOpenButton ? t("Bấm lần nữa để mở chi tiết", "Click again to open the details") : undefined
        }
        aria-label={`${t("Chọn trang bị", "Select item")} ${name}`}
        aria-pressed={selected}
      >
        <span className="shop-item-art relative shrink-0">
          {item.content.iconAssetId ? (
            <HeroAsset id={item.content.iconAssetId} alt="" className="size-11 rounded-lg" frameAspectRatio={1} />
          ) : (
            <span
              className="relative flex size-11 items-center justify-center rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 text-amber-600"
              title={t("Chưa có biểu tượng", "No icon yet")}
            >
              <Fallback aria-hidden className="size-5 opacity-70" />
              <ImageOff
                aria-label={t("Chưa có biểu tượng", "No icon yet")}
                className="absolute -top-1 -left-1 size-3.5 rounded-full bg-card"
              />
            </span>
          )}
          <ItemPrice amount={item.content.price} badge />
        </span>
        <span className="min-w-0 flex-1 space-y-0.5">
          <ShopCardText text={name} />
          {summary && <ShopCardText text={summary} summary />}
          <ItemStatChips stats={stats} locale={locale} limit={3} className="shop-item-stats" />
          {!!changeKinds.length && <CatalogChangeBadges kinds={changeKinds} compact />}
          <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground empty:hidden">
            {region !== "completed" && item.content.tier !== null && item.content.tier !== column + 1 && (
              <span
                className="rounded bg-muted px-1.5 py-0.5 text-xs"
                title={t(
                  `Trang bị cấp ${item.content.tier}, hiển thị ở cột ${column + 1}`,
                  `Tier ${item.content.tier} item, shown in column ${column + 1}`,
                )}
              >
                {t("Cấp", "Tier")} {item.content.tier}
              </span>
            )}
            {!locked && (
              <span
                className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300"
                title={t("Bản nháp chưa xuất bản", "Unpublished draft")}
              >
                {item.revision.effectiveFromPatchVariantId
                  ? t("Nháp", "Draft")
                  : t("Nháp · Chưa gắn patch", "Draft · No patch yet")}
              </span>
            )}
            {item.revision.state === "PUBLISHED" && !item.revision.effectiveFromPatchVariantId && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{t("Chưa rõ patch", "Patch unknown")}</span>
            )}
            {item.content.recipeStatus === "UNKNOWN" && (
              <span
                className="rounded bg-muted px-1.5 py-0.5 text-xs"
                title={t("Công thức chưa xác nhận", "Recipe not confirmed")}
              >
                {t("Công thức?", "Recipe?")}
              </span>
            )}
            {missing > 0 && (
              <span
                className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-300"
                title={t(
                  `Còn thiếu ${missing} mục bắt buộc để xuất bản`,
                  `${missing} required ${missing === 1 ? "field is" : "fields are"} still missing before publishing`,
                )}
              >
                {t("Thiếu", "Missing")} {missing}
              </span>
            )}
          </span>
        </span>
      </button>
      {showOpenButton && (
        // Always in view; on the chosen card it grows into a labelled button, the obvious next step.
        <Button
          type="button"
          variant={selected ? "default" : "ghost"}
          size={selected ? "sm" : "icon-sm"}
          className={cn(
            "shop-item-open absolute top-1 right-1 z-30",
            selected ? "h-7 gap-1 px-2 shadow-sm" : "size-7 bg-card/90 text-muted-foreground hover:text-foreground",
          )}
          aria-label={`${t("Xem trang bị", "View item")} ${name}`}
          title={locked ? t("Mở chi tiết", "Open details") : t("Mở bản nháp", "Open draft")}
          onClick={onOpen}
        >
          <PanelRightOpen className="size-4" />
          {selected && t("Mở", "Open")}
        </Button>
      )}
      {editable &&
        (["in", "out"] as const)
          .filter((side) => (side === "in" ? column > 0 : hasOutput))
          .map((side) => (
            <button
              key={side}
              type="button"
              data-link-id={editable ? item.id : undefined}
              data-link-side={side}
              aria-label={`${side === "in" ? t("Ghép từ", "Built from") : t("Nâng cấp từ", "Upgrades from")} ${name}`}
              aria-pressed={armed?.id === item.id && armed.side === side}
              disabled={!editable}
              title={
                side === "in"
                  ? t("Ghép từ: nối với nguyên liệu", "Built from: link to an ingredient")
                  : t("Nâng cấp: nối tới món đích", "Upgrade: link to the result item")
              }
              onClick={() => onPort({ id: item.id, side })}
              className={cn(
                "absolute top-1/2 z-20 flex h-11 w-6 -translate-y-1/2 touch-none items-center justify-center rounded-lg text-muted-foreground enabled:cursor-crosshair enabled:hover:text-primary focus-visible:outline-2 focus-visible:outline-ring data-[connection-compatible=true]:text-primary/70 data-[connection-source=true]:bg-primary/10 data-[connection-source=true]:text-primary data-[connection-target=true]:bg-primary/15 data-[connection-target=true]:text-primary data-[connection-target=true]:ring-2 data-[connection-target=true]:ring-primary/50",
                side === "in" ? "left-0" : "right-0",
                // Ports stay out of sight until a card is hovered, wired into the selection, or a connection is open.
                !armed &&
                  !selected &&
                  !related &&
                  "opacity-0 transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100 data-[connection-compatible=true]:opacity-100 data-[connection-source=true]:opacity-100 [@media(hover:none)]:opacity-100",
                armed?.id === item.id && armed.side === side && "text-primary",
              )}
            >
              <Circle
                className={cn(
                  "size-3 fill-card stroke-2",
                  armed?.id === item.id && armed.side === side && "fill-primary/20",
                )}
              />
            </button>
          ))}
    </div>
  )
}
/** One cell of the board, where a dragged card can be dropped. */
export function GraphCell({
  row,
  column,
  track,
  children,
}: {
  row: number
  column: number
  track: number
  children?: ReactNode
}) {
  const t = useWarehouseText()
  const slot = useId()
  const drop = useDroppable({ id: `cell:${row}:${column}:${slot}`, data: { row, column } })
  return (
    <div
      ref={drop.setNodeRef}
      style={{ gridRow: track }}
      aria-label={t(`Hàng ${row + 1}, cột ${column + 1}`, `Row ${row + 1}, column ${column + 1}`)}
      className={cn(
        "shop-cell grid min-h-20 min-w-0 auto-rows-fr gap-2 rounded-xl border border-dashed border-transparent p-1",
        !children && "border-border/60",
        drop.isOver && "border-primary bg-primary/5",
      )}
    >
      {children}
    </div>
  )
}

/** Follows the pointer while a card is dragged, so the move stays visible when the page scrolls. */
export function DragGhost({ item, locale }: { item: Entry; locale: string }) {
  return (
    <div
      className="flex cursor-grabbing items-center gap-2 rounded-xl border border-primary bg-card p-2 shadow-lg"
      style={{ width: columnWidth }}
    >
      <HeroAsset id={item.content.iconAssetId} alt="" className="size-9 shrink-0 rounded-lg" frameAspectRatio={1} />
      <span className="line-clamp-2 min-w-0 text-xs leading-tight font-medium">{warehouseName(item, locale)}</span>
    </div>
  )
}
