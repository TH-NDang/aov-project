import { itemShopLayout, itemShopSections } from "./item-shop-layout"
import { ItemShopRegionHelp } from "./item-shop-region-help"
import { CatalogChangeBadges } from "./catalog-changes"
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { Circle, GripVertical, Link2, PanelRightOpen, Plus } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { HeroAsset } from "../publishing/hero-content"
import { control } from "../publishing/fields"
import { itemEdges, selectedItemEdges, routeItemWire, type CardRect } from "./item-graph"
import {
  warehouseName,
  warehouseText,
  type ItemContent,
  type WarehouseEntry,
  type WarehouseMetadata,
} from "./warehouse-types"

type Entry = WarehouseEntry<ItemContent>
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
const columnWidth = 272
const portInset = 16
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
  onConnect: (from: string, to: string) => void
  onMove: (id: string, positionIndex: number, row: number, column: number) => void
  editable: boolean
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
  reference = false,
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
  reference?: boolean
}) {
  const drag = useDraggable({
    id: `${item.id}:${index}`,
    data: { itemId: item.id, index },
    disabled: !editable || reference,
  })
  const name = warehouseName(item, locale)
  const hasOutput = column < columns - 1 && !terminal
  return (
    <div
      ref={drag.setNodeRef}
      data-item-node={item.id}
      data-shop-reference={reference || undefined}
      className={cn(
        "relative flex min-h-20 min-w-[260px] items-center gap-1 rounded-xl border bg-card p-2 shadow-sm",
        column > 0 && "pl-9",
        hasOutput && "pr-9",
        selected ? "border-primary ring-2 ring-primary/20" : related ? "border-primary/40" : "",
        drag.isDragging && "opacity-40",
      )}
    >
      {editable && !reference && (
        <button
          type="button"
          aria-label={`Di chuyển ${name}`}
          className="touch-none self-stretch text-muted-foreground hover:text-foreground"
          {...drag.listeners}
          {...drag.attributes}
        >
          <GripVertical className="size-3.5" />
        </button>
      )}
      <button
        type="button"
        className="group flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-ring"
        onClick={onSelect}
        aria-label={`Chọn trang bị ${name}`}
        aria-pressed={selected}
      >
        <HeroAsset id={item.content.iconAssetId} alt="" className="size-10 shrink-0 rounded-lg" />
        <span className="min-w-0">
          <span className="block text-xs font-medium leading-5 sm:text-sm">{name}</span>
          {!!item.changeKinds?.length && <CatalogChangeBadges kinds={item.changeKinds} compact />}
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>
              {item.content.price?.toLocaleString("vi-VN") ?? "—"} <span className="text-amber-600">vàng</span>
            </span>
            {item.content.tier !== null && item.content.tier !== column + 1 && (
              <span
                className="rounded bg-muted px-1.5 py-0.5 text-[10px]"
                title={`Trang bị cấp ${item.content.tier}, hiển thị ở cột ${column + 1}`}
              >
                Cấp {item.content.tier}
              </span>
            )}
          </span>
        </span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-8 shrink-0"
        aria-label={`Xem trang bị ${name}`}
        title="Mở chi tiết"
        onClick={onOpen}
      >
        <PanelRightOpen className="size-4" />
      </Button>
      {(["in", "out"] as const)
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
              "absolute top-1/2 z-20 flex h-11 w-8 -translate-y-1/2 touch-none items-center justify-center rounded-lg text-muted-foreground enabled:cursor-crosshair enabled:hover:text-primary focus-visible:outline-2 focus-visible:outline-ring data-[connection-compatible=true]:text-primary/70 data-[connection-source=true]:bg-primary/10 data-[connection-source=true]:text-primary data-[connection-target=true]:bg-primary/15 data-[connection-target=true]:text-primary data-[connection-target=true]:ring-2 data-[connection-target=true]:ring-primary/50",
              side === "in" ? "left-0" : "right-0",
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
function GraphCell({ row, column, children }: { row: number; column: number; children?: React.ReactNode }) {
  const slot = useId()
  const drop = useDroppable({ id: `cell:${row}:${column}:${slot}`, data: { row, column } })
  return (
    <div
      ref={drop.setNodeRef}
      aria-label={`Hàng ${row + 1}, cột ${column + 1}`}
      className={cn(
        "min-h-24 space-y-2 rounded-xl border border-dashed border-transparent px-1 py-1",
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
}: Props) {
  const [variant, setVariant] = useState("")
  const [more, setMore] = useState(0)
  const [armed, setArmed] = useState<Port | null>(null)
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
    onConnect(a.side === "out" ? a.id : b.id, a.side === "in" ? a.id : b.id)
  }
  function portClick(port: Port) {
    if (Date.now() < suppressClick.current) return
    if (armed?.id === port.id && armed.side === port.side) setArmed(null)
    else if (armed?.side === port.side) setArmed(port)
    else if (armed) connect(armed, port)
    else setArmed(port)
  }
  function endDrag(event: DragEndEvent) {
    suppressClick.current = Date.now() + 300
    const from = event.active.data.current as { itemId: string; index: number } | undefined
    const to = event.over?.data.current as { row: number; column: number } | undefined
    if (from && to) onMove(from.itemId, from.index, to.row, to.column)
  }
  return (
    <section className="min-w-0 space-y-3" aria-label="Sơ đồ trang bị">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {categories.map((group) => (
            <Button
              key={group.code}
              variant={category === group.code ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                onCategory(group.code)
                onFocus(null)
                setVariant("")
                setMore(0)
              }}
            >
              {warehouseText(group.translations, locale)?.name || group.code}
            </Button>
          ))}
        </div>
        {!!variants.length && (
          <select
            aria-label="Nhánh trang bị"
            className={`${control} w-auto`}
            value={variant}
            onChange={(event) => setVariant(event.target.value)}
          >
            <option value="">Mọi nhánh</option>
            {variants.map((v) => (
              <option key={v} value={v}>
                {items
                  .map((item) => warehouseText(item.content.translations, locale)?.variantLabels?.[v])
                  .find(Boolean) || v}
              </option>
            ))}
          </select>
        )}
        {editable && (
          <Button variant="outline" size="sm" onClick={() => setMore((count) => count + 2)}>
            <Plus className="size-4" />
            Thêm hàng
          </Button>
        )}
      </div>
      <p className="flex min-h-6 items-center gap-2 text-xs text-muted-foreground">
        <Link2 className="size-3.5 shrink-0" />
        {armed
          ? `Đang nối ${warehouseName(byId.get(armed.id)!, locale)} · chọn chấm ở phía đối diện. Esc để hủy.`
          : "Chọn món để xem đường ghép. Nối hai chấm hoặc kéo giữa chúng; kéo tay nắm để đổi ô."}
      </p>
      {selectedId && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="h-0 w-7 border-t-[3px] border-primary" />
            Nguyên liệu trực tiếp
          </span>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="h-0 w-7 border-t border-dashed border-primary" />
            Nguyên liệu gián tiếp / nâng cấp
          </span>
          <Button size="sm" variant="ghost" onClick={() => onFocus(null)}>
            Bỏ chọn
          </Button>
        </div>
      )}
      <DndContext
        sensors={sensors}
        onDragEnd={endDrag}
        onDragCancel={() => {
          suppressClick.current = Date.now() + 300
        }}
      >
        <div
          ref={scrollArea}
          className="overflow-x-auto rounded-xl border bg-muted/15"
          tabIndex={0}
          aria-label="Bảng vị trí trang bị"
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
            className="relative p-7 [contain:layout_paint]"
            style={{ minWidth: columns * columnWidth + (columns - 1) * 48 + 56 }}
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
                  .filter((target) => target.dataset.linkId !== port.dataset.linkId && target.dataset.linkSide !== side)
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
              if (!session.dragged && Math.hypot(event.clientX - session.startX, event.clientY - session.startY) > 6) {
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
              className="grid items-start gap-x-12"
              style={{ gridTemplateColumns: `repeat(${columns},minmax(${columnWidth}px,1fr))` }}
            >
              {Array.from({ length: columns }, (_, column) => {
                const native = placements.filter((p) => p.position.column === column && positioned(p.position))
                const sections = itemShopSections(placements, column)
                const lastRow = Math.max(-1, ...native.map((p) => p.position.row!))
                const references = external.filter((p) => p.position?.column === column && positioned(p.position))
                const groups = [...new Set(references.map((p) => p.categoryCode))]
                const card = (placement: (typeof placements)[number], reference = false) => (
                  <GraphCard
                    key={`${placement.item.id}:${placement.index}`}
                    item={placement.item}
                    index={placement.index}
                    editable={editable && placement.item.revision.state === "DRAFT"}
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
                    reference={reference}
                  />
                )
                return (
                  <section key={column} aria-label={`Cột ${column + 1}`} className="min-w-0 space-y-3">
                    <h3 className="pb-2 text-center text-xs font-medium text-muted-foreground">Cột {column + 1}</h3>
                    {sections.map((section) => {
                      const firstRow = section.rows[0].row
                      const lastRow = section.rows.at(-1)!.row
                      const cells = section.rows.map(({ row, placements }) => (
                        <GraphCell key={row} row={row} column={column}>
                          {placements.map((placement) => card(placement))}
                        </GraphCell>
                      ))
                      return section.terminal ? (
                        <section
                          key={firstRow}
                          aria-label={`Trang bị hoàn chỉnh · Cột ${column + 1} · Hàng ${firstRow + 1}–${lastRow + 1}`}
                          className="space-y-2 rounded-xl border bg-muted/25 py-2"
                        >
                          <h4 className="flex items-center gap-1 px-3 text-xs font-medium text-muted-foreground">
                            Trang bị hoàn chỉnh
                            <ItemShopRegionHelp kind="terminal" />
                          </h4>
                          {cells}
                        </section>
                      ) : (
                        <div key={firstRow} className="space-y-2">
                          {cells}
                        </div>
                      )
                    })}
                    {more > 0 && (
                      <div className="space-y-2">
                        {Array.from({ length: more }, (_, index) => (
                          <GraphCell
                            key={index}
                            row={Math.max(native.length ? 0 : 3, lastRow + 1) + index}
                            column={column}
                          />
                        ))}
                      </div>
                    )}
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
                            <span className="text-muted-foreground">Thuộc tính khác</span>
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
                                true,
                              ),
                            )}
                        </section>
                      )
                    })}
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
              {paths.map((path) => (
                <g key={path.key} className="text-primary" opacity={path.direct ? 1 : 0.65}>
                  <path d={path.d} fill="none" stroke="var(--background)" strokeWidth="7" />
                  <path
                    d={path.d}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={path.direct ? 3.2 : 1.6}
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
      </DndContext>
      {[...placements, ...external].some((p) => !positioned(p.position)) && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">Chưa xếp ô</span>
          {[...placements, ...external]
            .filter((p) => !positioned(p.position))
            .map(({ item, index }) => (
              <Button key={`${item.id}:${index}`} size="sm" variant="outline" onClick={() => onSelect(item.id)}>
                {warehouseName(item, locale)}
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
