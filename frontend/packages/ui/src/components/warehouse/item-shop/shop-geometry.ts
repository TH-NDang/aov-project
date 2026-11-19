import type { ItemContent, WarehouseEntry } from "@aov/ui/lib/warehouse-content"

export type Entry = WarehouseEntry<ItemContent>
export type CardRegion = "standard" | "completed" | "external"
/** One end of a card: `in` takes ingredients, `out` leads to what the item builds into. */
export type Port = { id: string; side: "in" | "out" }
export type PortTarget = Port & {
  element: HTMLElement
  x: number
  y: number
  left: number
  right: number
  top: number
  bottom: number
}
/** A link being dragged from a port, with the ports it may land on. */
export type ConnectionPointer = {
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

export const columnWidth = "var(--shop-column-width, 232px)"
export const portInset = 12
export const portRadius = 6

/** The nearest ancestor that scrolls vertically, so dragging near the top or bottom edge can move the page. */
export function verticalScroller(element: HTMLElement | null): HTMLElement {
  for (let node = element?.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY
    if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) return node
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement
}

/** Speed in pixels per millisecond when the pointer is inside the edge band of a scroll viewport. */
export function edgeSpeed(position: number, start: number, end: number, band: number) {
  if (position < start + band) return -Math.min(1, (start + band - position) / band)
  if (position > end - band) return Math.min(1, (position - end + band) / band)
  return 0
}

/** The port the dragged link snaps to: the closest centre among the ports within the magnet's reach. */
export function nearestPort(session: ConnectionPointer, x: number, y: number) {
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

/** A shop position with a row and a column the board can draw. */
export function positioned(position: ItemContent["shopPositions"][number] | null) {
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
