import { useWarehouseText } from "./warehouse-view"
import { itemShopLayout, itemShopRowTracks, itemShopSections } from "@aov/ui/lib/item-shop-layout"
import { ItemShopRegionHelp } from "./item-shop-region-help"
import { ItemPrice } from "./item-price"
import { cardChangeKinds, WarehouseBadges as CatalogChangeBadges } from "./warehouse-view"
import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { Circle, GripVertical, ImageOff, Link2, PanelRightOpen } from "lucide-react"
import { ItemCategoryIcon, itemCategoryFallback } from "./item-category-icon"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { FilterTab, FilterTabs } from "@aov/ui/components/filter-tabs"
import { WarehouseAsset as HeroAsset } from "./warehouse-view"

import { itemEdges, selectedItemEdges, routeItemWire, type CardRect } from "@aov/ui/lib/item-graph"
import {
  warehouseName,
  warehouseText,
  type ItemContent,
  type WarehouseEntry,
  type WarehouseMetadata,
} from "@aov/ui/lib/warehouse-content"

type Entry = WarehouseEntry<ItemContent>
type CardRegion = "standard" | "completed" | "external"
type Port = { id: string; side: "in" | "out" }
type PortTarget = Port & {
  element: HTMLElement
  x: number
  y: number
  left: number
  right: number
  top: number
  bottom: number
}
type ConnectionPointer = {
  port: Port
  element: HTMLElement
  pointerId: number
  x: number
  y: number
  startX: number
  startY: number
  origin: { x: number; y: number }
  targets: PortTarget[]
  magnetRadius: number
  dragged: boolean
  target: PortTarget | null
}
/** The nearest ancestor that scrolls vertically, so dragging near the top or bottom edge can move the page. */
function verticalScroller(element: HTMLElement | null): HTMLElement {
  for (let node = element?.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY
    if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) return node
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement
}
/** Speed in pixels per millisecond when the pointer is inside the edge band of a scroll viewport. */
function edgeSpeed(position: number, start: number, end: number, band: number) {
  if (position < start + band) return -Math.min(1, (start + band - position) / band)
  if (position > end - band) return Math.min(1, (position - end + band) / band)
  return 0
}
const columnWidth = "var(--shop-column-width, 232px)"
const portInset = 12
const portRadius = 6
function positioned(position: ItemContent["shopPositions"][number] | null) {
  return (
    position !== null &&
    position.row !== null &&
    position.column !== null &&
    Number.isInteger(position.row) &&
    position.row >= 0 &&
    Number.isInteger(position.column) &&
    position.column >= 0
  )
}
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
}
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

function GraphCard({
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
}) {
  const t = useWarehouseText()
  const reference = region === "external"
  const drag = useDraggable({
    id: `${item.id}:${index}`,
    data: { itemId: item.id, index },
    disabled: !editable || reference,
  })
  const name = warehouseName(item, locale)
  const summary = warehouseText(item.content.translations, locale)?.summary?.trim()
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
          aria-label={`Di chuyển ${name}`}
          title="Kéo để đổi ô"
          className="cursor-grab touch-none self-stretch text-muted-foreground opacity-0 transition-opacity group-hover/card:opacity-100 hover:text-foreground focus-visible:opacity-100 active:cursor-grabbing [@media(hover:none)]:opacity-100"
          {...drag.listeners}
          {...drag.attributes}
        >
          <GripVertical className="size-3.5" />
        </button>
      )}
      <button
        type="button"
        className="shop-item-select group flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-ring"
        onClick={onSelect}
        aria-label={`${t("Chọn trang bị", "Select item")} ${name}`}
        aria-pressed={selected}
      >
        <span className="shop-item-art relative shrink-0">
          {item.content.iconAssetId ? (
            <HeroAsset id={item.content.iconAssetId} alt="" className="size-11 rounded-lg" frameAspectRatio={1} />
          ) : (
            <span
              className="relative flex size-11 items-center justify-center rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 text-amber-600"
              title="Chưa có icon"
            >
              <Fallback aria-hidden className="size-5 opacity-70" />
              <ImageOff aria-label="Chưa có icon" className="absolute -top-1 -left-1 size-3.5 rounded-full bg-card" />
            </span>
          )}
          <ItemPrice amount={item.content.price} locale={locale} badge />
        </span>
        <span className="min-w-0 flex-1 space-y-0.5">
          <ShopCardText text={name} />
          {summary && <ShopCardText text={summary} summary />}
          {!!changeKinds.length && <CatalogChangeBadges kinds={changeKinds} compact />}
          <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground empty:hidden">
            {region !== "completed" && item.content.tier !== null && item.content.tier !== column + 1 && (
              <span
                className="rounded bg-muted px-1.5 py-0.5 text-xs"
                title={`Trang bị cấp ${item.content.tier}, hiển thị ở cột ${column + 1}`}
              >
                Cấp {item.content.tier}
              </span>
            )}
            {!locked && (
              <span
                className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300"
                title="Bản nháp chưa xuất bản"
              >
                {item.revision.effectiveFromPatchVariantId ? "Nháp" : "Nháp · Chưa gắn patch"}
              </span>
            )}
            {item.revision.state === "PUBLISHED" && !item.revision.effectiveFromPatchVariantId && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{t("Chưa rõ patch", "Patch unknown")}</span>
            )}
            {item.content.recipeStatus === "UNKNOWN" && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs" title="Công thức chưa xác nhận">
                Công thức?
              </span>
            )}
            {missing > 0 && (
              <span
                className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-300"
                title={`Còn thiếu ${missing} mục bắt buộc để xuất bản`}
              >
                Thiếu {missing}
              </span>
            )}
          </span>
        </span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn(
          "shop-item-open absolute top-0.5 right-0.5 z-30 size-6 bg-card/90",
          locked &&
            "opacity-0 transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
        )}
        aria-label={`${t("Xem trang bị", "View item")} ${name}`}
        title={locked ? "Mở chi tiết" : "Mở bản nháp"}
        onClick={onOpen}
      >
        <PanelRightOpen className="size-3.5" />
      </Button>
      {editable &&
        (["in", "out"] as const)
          .filter((side) => (side === "in" ? column > 0 : hasOutput))
          .map((side) => (
            <button
              key={side}
              type="button"
              data-link-id={editable ? item.id : undefined}
              data-link-side={side}
              aria-label={`${side === "in" ? "Ghép từ" : "Nâng cấp từ"} ${name}`}
              aria-pressed={armed?.id === item.id && armed.side === side}
              disabled={!editable}
              title={side === "in" ? "Ghép từ: nối với nguyên liệu" : "Nâng cấp: nối tới món đích"}
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
function GraphCell({
  row,
  column,
  track,
  children,
}: {
  row: number
  column: number
  track: number
  children?: React.ReactNode
}) {
  const slot = useId()
  const drop = useDroppable({ id: `cell:${row}:${column}:${slot}`, data: { row, column } })
  return (
    <div
      ref={drop.setNodeRef}
      style={{ gridRow: track }}
      aria-label={`Hàng ${row + 1}, cột ${column + 1}`}
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
}: Props) {
  const t = useWarehouseText()
  const [variant, setVariant] = useState("")
  const [armed, setArmed] = useState<Port | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [paths, setPaths] = useState<{ key: string; d: string; label: string; to: string; direct: boolean }[]>([])
  const canvas = useRef<HTMLDivElement>(null)
  const scrollArea = useRef<HTMLDivElement>(null)
  const pointer = useRef<ConnectionPointer | null>(null)
  const preview = useRef<SVGGElement>(null)
  const previewHalo = useRef<SVGPathElement>(null)
  const previewWire = useRef<SVGPathElement>(null)
  const previewTip = useRef<SVGCircleElement>(null)
  const previewFrame = useRef(0)
  const previewTime = useRef(0)
  const suppressClick = useRef(0)
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
  const lastTrack = rowTracks.at(-1)!
  const edges = useMemo(() => selectedItemEdges(itemEdges(items), selectedId), [items, selectedId])
  const related = new Set(edges.flatMap((edge) => [edge.from, edge.to]))
  useLayoutEffect(() => {
    const element = canvas.current
    if (!element) return
    if (!edges.length) {
      setPaths((previous) => (previous.length ? [] : previous))
      return
    }
    let frame = 0
    let previousGeometry = ""
    function measure() {
      if (!element) return
      const bounds = element.getBoundingClientRect(),
        nodes = [...element.querySelectorAll<HTMLElement>("[data-item-node]")]
      const rect = (r: DOMRect): CardRect => ({
        left: r.left - bounds.left,
        right: r.right - bounds.left,
        top: r.top - bounds.top,
        bottom: r.bottom - bounds.top,
      })
      const rects = nodes.map((node) => rect(node.getBoundingClientRect()))
      const geometry = JSON.stringify(rects)
      if (geometry === previousGeometry) return
      previousGeometry = geometry
      const map = new Map<string, CardRect>()
      nodes.forEach((node, i) => {
        if (!map.has(node.dataset.itemNode!)) map.set(node.dataset.itemNode!, rects[i])
      })
      setPaths(
        edges.flatMap((edge, index) => {
          const source = map.get(edge.from),
            target = map.get(edge.to)
          if (!source || !target) return []
          const route = routeItemWire(source, target, rects, index)
          const points = route && [
            { x: source.right - portInset + portRadius, y: (source.top + source.bottom) / 2 },
            ...route,
            { x: target.left + portInset - portRadius, y: (target.top + target.bottom) / 2 },
          ]
          return points
            ? [
                {
                  key: `${edge.from}:${edge.to}`,
                  to: edge.to,
                  direct: edge.direct,
                  d: points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" "),
                  label: `${warehouseName(byId.get(edge.from)!, locale)} ×${edge.quantity} → ${warehouseName(byId.get(edge.to)!, locale)}`,
                },
              ]
            : []
        }),
      )
    }
    const resize = new ResizeObserver(() => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0
          measure()
        })
    })
    resize.observe(element)
    element.querySelectorAll("[data-item-node]").forEach((node) => resize.observe(node))
    measure()
    return () => {
      resize.disconnect()
      cancelAnimationFrame(frame)
      cancelConnection()
    }
  }, [placements, external, edges, byId, locale, more])
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !pointer.current) return
      event.preventDefault()
      event.stopPropagation()
      cancelConnection()
      setArmed(null)
    }
    const blur = () => cancelConnection()
    window.addEventListener("keydown", escape, true)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keydown", escape, true)
      window.removeEventListener("blur", blur)
      cancelConnection()
    }
  }, [])
  useEffect(() => {
    const viewport = scrollArea.current
    if (!viewport) return
    const surface = viewport.closest<HTMLElement>("[data-item-selection-surface]") ?? viewport
    const boundary = surface.closest<HTMLElement>("[data-page-tab]") ?? surface
    let gesture: { id: number; x: number; y: number; moved: boolean } | null = null
    const inside = (target: EventTarget | null): target is Element =>
      target instanceof Element &&
      boundary.contains(target) &&
      (target.closest("[data-item-selection-surface]") ?? surface) === surface
    function start(event: PointerEvent) {
      gesture =
        event.button === 0 && inside(event.target)
          ? { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
          : null
    }
    function move(event: PointerEvent) {
      if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 6)
        gesture.moved = true
    }
    function cancel() {
      if (gesture) gesture.moved = true
    }
    function dismiss(event: MouseEvent) {
      if (!surface.isConnected || surface.closest("[hidden],[inert]") || !inside(event.target)) return
      if (event.defaultPrevented || pointer.current || gesture?.moved || Date.now() < suppressClick.current) return
      if (
        event.target.closest(
          '[data-item-node],button,a,input,select,textarea,label,[contenteditable="true"],[role="button"],[role="tab"],[role="menuitem"],[role="combobox"],[role="dialog"],[role="menu"],[role="listbox"]',
        )
      )
        return
      cancelConnection()
      setArmed(null)
      onFocus(null)
    }
    document.addEventListener("pointerdown", start, true)
    document.addEventListener("pointermove", move, true)
    document.addEventListener("pointercancel", cancel, true)
    document.addEventListener("scroll", cancel, true)
    document.addEventListener("click", dismiss, true)
    return () => {
      document.removeEventListener("pointerdown", start, true)
      document.removeEventListener("pointermove", move, true)
      document.removeEventListener("pointercancel", cancel, true)
      document.removeEventListener("scroll", cancel, true)
      document.removeEventListener("click", dismiss, true)
    }
  }, [onFocus])
  function nearestPort(session: ConnectionPointer, x: number, y: number) {
    let closest: PortTarget | null = null
    let distance = Infinity
    for (const target of session.targets) {
      const dx = Math.max(target.left - x, 0, x - target.right)
      const dy = Math.max(target.top - y, 0, y - target.bottom)
      const centerDistance = Math.hypot(target.x - x, target.y - y)
      if (Math.hypot(dx, dy) <= session.magnetRadius && centerDistance < distance) {
        closest = target
        distance = centerDistance
      }
    }
    return closest
  }
  function drawConnection(time: number) {
    previewFrame.current = 0
    const session = pointer.current
    const element = canvas.current
    if (!session?.dragged || !element) return
    const elapsed = previewTime.current ? Math.min(32, time - previewTime.current) : 16
    previewTime.current = time
    const scroller = scrollArea.current
    let scrolling = false
    if (scroller) {
      const viewport = scroller.getBoundingClientRect()
      const margin = Math.min(56, viewport.width / 5)
      const left = Math.max(0, Math.min(1, (viewport.left + margin - session.x) / margin))
      const right = Math.max(0, Math.min(1, (session.x - viewport.right + margin) / margin))
      if (
        session.y >= viewport.top &&
        session.y <= viewport.bottom &&
        session.x >= viewport.left - 24 &&
        session.x <= viewport.right + 24
      ) {
        const before = scroller.scrollLeft
        scroller.scrollLeft += (right - left) * elapsed * 0.55
        scrolling = scroller.scrollLeft !== before
      }
    }
    const page = verticalScroller(scroller ?? element)
    const pageRect =
      page === document.scrollingElement || page === document.documentElement
        ? { top: 0, bottom: window.innerHeight }
        : page.getBoundingClientRect()
    const vertical = edgeSpeed(session.y, pageRect.top, pageRect.bottom, 72)
    if (vertical) {
      const before = page.scrollTop
      page.scrollTop += vertical * elapsed * 0.9
      scrolling ||= page.scrollTop !== before
    }
    const bounds = element.getBoundingClientRect()
    const x = session.x - bounds.left
    const y = session.y - bounds.top
    const target = nearestPort(session, x, y)
    if (target !== session.target) {
      session.target?.element.removeAttribute("data-connection-target")
      target?.element.setAttribute("data-connection-target", "true")
      session.target = target
    }
    const moving = target ? { x: target.x, y: target.y } : { x, y }
    const start = session.port.side === "out" ? session.origin : moving
    const end = session.port.side === "in" ? session.origin : moving
    const startX = start.x + (session.port.side === "out" || target ? portRadius : 0)
    const endX = end.x - (session.port.side === "in" || target ? portRadius : 0)
    const bend = Math.max(48, Math.min(160, Math.abs(endX - startX) * 0.45))
    const d = `M${startX},${start.y} C${startX + bend},${start.y} ${endX - bend},${end.y} ${endX},${end.y}`
    previewHalo.current?.setAttribute("d", d)
    previewWire.current?.setAttribute("d", d)
    previewWire.current?.setAttribute("stroke-dasharray", target ? "" : "6 5")
    previewTip.current?.setAttribute("cx", String(moving.x))
    previewTip.current?.setAttribute("cy", String(moving.y))
    previewTip.current?.setAttribute("r", target ? "8" : "4")
    preview.current?.setAttribute("visibility", "visible")
    preview.current?.setAttribute("data-connection-preview", target ? "snapped" : "dragging")
    if (scrolling) queueConnection()
  }
  function queueConnection() {
    if (!previewFrame.current) previewFrame.current = requestAnimationFrame(drawConnection)
  }
  function clearConnection() {
    const session = pointer.current
    pointer.current = null
    cancelAnimationFrame(previewFrame.current)
    previewFrame.current = 0
    previewTime.current = 0
    preview.current?.setAttribute("visibility", "hidden")
    preview.current?.removeAttribute("data-connection-preview")
    session?.element.removeAttribute("data-connection-source")
    session?.targets.forEach((target) => {
      target.element.removeAttribute("data-connection-compatible")
      target.element.removeAttribute("data-connection-target")
    })
    if (session?.element.hasPointerCapture?.(session.pointerId))
      session.element.releasePointerCapture(session.pointerId)
    return session
  }
  function cancelConnection() {
    const session = clearConnection()
    if (session) suppressClick.current = Date.now() + 300
  }
  function connect(a: Port, b: Port) {
    setArmed(null)
    if (a.side === b.side || a.id === b.id) return
    onConnect?.(a.side === "out" ? a.id : b.id, a.side === "in" ? a.id : b.id)
  }
  function portClick(port: Port) {
    if (Date.now() < suppressClick.current) return
    if (armed?.id === port.id && armed.side === port.side) setArmed(null)
    else if (armed?.side === port.side) setArmed(port)
    else if (armed) connect(armed, port)
    else setArmed(port)
  }
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
  return (
    <section className="min-w-0 space-y-3" aria-label={t("Sơ đồ trang bị", "Equipment shop")}>
      <div className="flex flex-wrap items-center gap-2">
        <FilterTabs label={t("Nhóm trang bị", "Item categories")}>
          {categories.map((group) => {
            const count = items.filter(
              (item) =>
                (!matches || matches.has(item.id)) &&
                item.content.shopPositions.some((position) => position.categoryCode === group.code),
            ).length
            const active = category === group.code
            return (
              <FilterTab
                key={group.code}
                active={active}
                count={count}
                title={matches ? `${count} món khớp tìm kiếm` : undefined}
                className={cn("[&_svg]:size-5", matches && !count && !active && "opacity-50")}
                onClick={() => {
                  onCategory(group.code)
                  onFocus(null)
                  setVariant("")
                  setMore(0)
                }}
              >
                <ItemCategoryIcon category={group} />
                {warehouseText(group.translations, locale)?.name || group.code}
              </FilterTab>
            )
          })}
        </FilterTabs>
        <span className="flex-1" />
        {editable && missingIcons.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-amber-700 dark:text-amber-300"
            title="Mở món đầu tiên chưa có icon"
            onClick={() => onSelect(missingIcons[0].id)}
          >
            <ImageOff className="size-4" />
            {missingIcons.length} món thiếu icon
          </Button>
        )}
        {!!variants.length && (
          <select
            aria-label="Nhánh trang bị"
            className="w-auto rounded-md border bg-background px-3 py-2 text-sm"
            value={variant}
            onChange={(event) => setVariant(event.target.value)}
          >
            <option value="">{t("Mọi nhánh", "All branches")}</option>
            {variants.map((v) => (
              <option key={v} value={v}>
                {items
                  .map((item) => warehouseText(item.content.translations, locale)?.variantLabels?.[v])
                  .find(Boolean) || v}
              </option>
            ))}
          </select>
        )}
      </div>
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
          {(armed || selectedId) && (
            // A zero-height sticky row keeps the hints in view without moving the board when they appear.
            <div className="shop-legend pointer-events-none sticky top-2 z-30 flex h-0 justify-end px-2">
              <div className="pointer-events-auto mt-2 flex max-w-[calc(100%-1rem)] flex-col items-end gap-1.5">
                {armed && (
                  <p
                    role="status"
                    className="flex items-center gap-2 rounded-lg border border-primary/30 bg-card/95 px-2.5 py-1.5 text-xs text-primary shadow-sm backdrop-blur"
                  >
                    <Link2 className="size-3.5 shrink-0" />
                    Đang nối {warehouseName(byId.get(armed.id)!, locale)} · chọn chấm ở phía đối diện. Esc để hủy.
                  </p>
                )}
                {selectedId && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-card/95 py-1 pr-1 pl-2.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="h-0 w-5 border-t-[3px] border-primary" />
                      {t("Nguyên liệu trực tiếp", "Direct ingredients")}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="h-0 w-5 border-t border-dashed border-primary" />
                      {t("Gián tiếp / nâng cấp", "Indirect / upgrade")}
                    </span>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onFocus(null)}>
                      {t("Bỏ chọn", "Clear selection")}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
          <div
            ref={scrollArea}
            className="shop-viewport overflow-x-auto rounded-xl border bg-muted/15"
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
              onPointerDown={(event) => {
                if (event.button !== 0 || pointer.current) return
                const port = (event.target as Element).closest<HTMLElement>("[data-link-id]")
                if (port) {
                  const element = event.currentTarget
                  const bounds = element.getBoundingClientRect()
                  const source = port.getBoundingClientRect()
                  const origin = {
                    x: (source.left + source.right) / 2 - bounds.left,
                    y: (source.top + source.bottom) / 2 - bounds.top,
                  }
                  const side = port.dataset.linkSide as Port["side"]
                  const targets = [...element.querySelectorAll<HTMLElement>("[data-link-id]")]
                    .filter(
                      (target) => target.dataset.linkId !== port.dataset.linkId && target.dataset.linkSide !== side,
                    )
                    .map((target): PortTarget => {
                      const rect = target.getBoundingClientRect()
                      return {
                        id: target.dataset.linkId!,
                        side: target.dataset.linkSide as Port["side"],
                        element: target,
                        x: (rect.left + rect.right) / 2 - bounds.left,
                        y: (rect.top + rect.bottom) / 2 - bounds.top,
                        left: rect.left - bounds.left,
                        right: rect.right - bounds.left,
                        top: rect.top - bounds.top,
                        bottom: rect.bottom - bounds.top,
                      }
                    })
                  port.setPointerCapture?.(event.pointerId)
                  port.setAttribute("data-connection-source", "true")
                  pointer.current = {
                    port: { id: port.dataset.linkId!, side },
                    element: port,
                    pointerId: event.pointerId,
                    x: event.clientX,
                    y: event.clientY,
                    startX: event.clientX,
                    startY: event.clientY,
                    origin,
                    targets,
                    magnetRadius: event.pointerType === "touch" ? 32 : 20,
                    dragged: false,
                    target: null,
                  }
                }
              }}
              onPointerMove={(event) => {
                const session = pointer.current
                if (!session || session.pointerId !== event.pointerId) return
                session.x = event.clientX
                session.y = event.clientY
                if (
                  !session.dragged &&
                  Math.hypot(event.clientX - session.startX, event.clientY - session.startY) > 6
                ) {
                  session.dragged = true
                  setArmed(null)
                  session.targets.forEach((target) => target.element.setAttribute("data-connection-compatible", "true"))
                }
                if (session.dragged) {
                  event.preventDefault()
                  queueConnection()
                }
              }}
              onPointerCancel={(event) => {
                if (pointer.current?.pointerId === event.pointerId) cancelConnection()
              }}
              onLostPointerCapture={(event) => {
                if (pointer.current?.pointerId === event.pointerId) cancelConnection()
              }}
              onPointerUp={(event) => {
                const session = pointer.current
                if (!session || session.pointerId !== event.pointerId) return
                const bounds = event.currentTarget.getBoundingClientRect()
                const target = nearestPort(session, event.clientX - bounds.left, event.clientY - bounds.top)
                clearConnection()
                if (!session.dragged) return
                suppressClick.current = Date.now() + 300
                if (target) connect(session.port, target)
                else setArmed(null)
              }}
            >
              <div
                className="grid justify-center gap-x-[var(--shop-gap,48px)] gap-y-2"
                style={{ gridTemplateColumns: `repeat(${columns}, ${columnWidth})` }}
              >
                {sectionsByColumn.map((sections, column) => {
                  const native = placements.filter((p) => p.position.column === column && positioned(p.position))
                  const nextRow = sections.at(-1)!.rows.at(-1)!.row + 1
                  const references = external.filter((p) => p.position?.column === column && positioned(p.position))
                  const groups = [...new Set(references.map((p) => p.categoryCode))]
                  const card = (placement: (typeof placements)[number], region: CardRegion) => (
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
                      onPort={portClick}
                      terminal={placement.terminal}
                      region={region}
                      dimmed={!!matches && !matches.has(placement.item.id)}
                    />
                  )
                  return (
                    <section
                      key={column}
                      aria-label={`${t("Cột", "Column")} ${column + 1}`}
                      className="grid min-w-0 grid-rows-subgrid"
                      style={{ gridColumn: column + 1, gridRow: `1 / span ${lastTrack + Number(groups.length > 0)}` }}
                    >
                      <h3 className="shop-column-label sticky top-0 z-10 mx-auto flex w-fit items-center gap-1.5 self-start rounded-full border bg-card px-3 py-0.5 text-xs font-semibold">
                        {t("Cột", "Column")} {column + 1}
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
                            {placements.map((placement) =>
                              card(placement, section.terminal ? "completed" : "standard"),
                            )}
                          </GraphCell>
                        ))
                        return section.terminal ? (
                          <section
                            key={firstRow}
                            aria-label={`Trang bị hoàn chỉnh · Cột ${column + 1} · Hàng ${firstRow + 1}–${lastRow + 1}`}
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
                      {Array.from({ length: more }, (_, index) => (
                        <GraphCell
                          key={index}
                          row={nextRow + index}
                          column={column}
                          track={rowTracks[nextRow + index]}
                        />
                      ))}
                      {groups.length > 0 && (
                        <div className="self-start space-y-3" style={{ gridRow: lastTrack + 1 }}>
                          {groups.map((code) => {
                            const group = categories.find((entry) => entry.code === code)
                            const name = group ? warehouseText(group.translations, locale)?.name || code : code
                            return (
                              <section
                                key={code ?? "unassigned"}
                                aria-label={`Thuộc tính khác · ${name || "Chưa phân loại"} · Cột ${column + 1}`}
                                className="space-y-3 border-t border-dashed pt-3"
                              >
                                <h4 className="flex flex-wrap items-center gap-x-2 px-1 text-xs">
                                  <span className="font-semibold">{name || "Chưa phân loại"}</span>
                                  <span className="text-muted-foreground">
                                    {t("Thuộc tính khác", "Other category")}
                                  </span>
                                  <ItemShopRegionHelp
                                    kind="external"
                                    sourceGroup={name || "Chưa phân loại"}
                                    selectedItem={
                                      byId.has(selectedId ?? "")
                                        ? warehouseName(byId.get(selectedId!)!, locale)
                                        : "món đang chọn"
                                    }
                                  />
                                </h4>
                                {references
                                  .filter((p) => p.categoryCode === code)
                                  .map((p) =>
                                    card(
                                      {
                                        item: p.item,
                                        position: p.position!,
                                        index: p.index,
                                        terminal: false,
                                      },
                                      "external",
                                    ),
                                  )}
                              </section>
                            )
                          })}
                        </div>
                      )}
                    </section>
                  )
                })}
              </div>
              <svg
                className="pointer-events-none absolute inset-0 z-10 size-full"
                aria-label="Đường ghép của trang bị được chọn"
              >
                <defs>
                  <marker
                    id={marker}
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="10"
                    markerHeight="10"
                    markerUnits="userSpaceOnUse"
                    orient="auto"
                  >
                    <path d="M0 0 L10 5 L0 10 Z" fill="context-stroke" />
                  </marker>
                </defs>
                <g aria-hidden="true" fill="none" stroke="var(--background)" strokeWidth="7" strokeLinejoin="round">
                  {paths.map((path) => (
                    <path key={path.key} d={path.d} data-recipe-halo="" />
                  ))}
                </g>
                {paths.map((path) => (
                  <g key={path.key} className="text-primary" opacity={path.direct ? 1 : 0.65}>
                    <path
                      d={path.d}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={path.direct ? 3.2 : 1.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={path.direct ? undefined : "6 5"}
                      markerEnd={`url(#${marker})`}
                      data-recipe-line={path.direct ? "direct" : "indirect"}
                    />
                    <path
                      d={path.d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="12"
                      className="pointer-events-auto cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-label={path.label}
                      onClick={() => onFocus(path.to)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          onFocus(path.to)
                        }
                      }}
                    >
                      <title>{path.label}</title>
                    </path>
                  </g>
                ))}
                <g ref={preview} visibility="hidden" aria-hidden="true" className="text-primary">
                  <path ref={previewHalo} fill="none" stroke="var(--background)" strokeWidth="7" />
                  <path
                    ref={previewWire}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    markerEnd={`url(#${marker})`}
                  />
                  <circle ref={previewTip} fill="var(--background)" stroke="currentColor" strokeWidth="2" />
                </g>
              </svg>
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
          {layout.missingIds.length} nguyên liệu hoặc món nâng cấp chưa có dữ liệu tại phạm vi đang xem.
        </p>
      )}
    </section>
  )
}

/** Follows the pointer while a card is dragged, so the move stays visible when the page scrolls. */
function DragGhost({ item, locale }: { item: Entry; locale: string }) {
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

/** How to use the shop board; the items page shows it in its header. */
