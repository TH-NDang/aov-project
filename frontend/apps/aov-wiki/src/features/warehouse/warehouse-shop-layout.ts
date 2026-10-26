import type { WarehouseContent, WarehouseEntry } from "./warehouse-types"

type ShopPosition = NonNullable<WarehouseContent["shopPositions"]>[number]

export interface ShopEdge {
  from: string
  to: string
  quantity: number
}

export interface ShopPlacement {
  entry: WarehouseEntry
  column: number
  row: number
  terminal: boolean
}

export interface ShopExternal {
  entry: WarehouseEntry
  column: number | null
  categoryCode: string | null
}

export interface ShopCardRect {
  left: number
  right: number
  top: number
  bottom: number
}

export interface ShopPoint {
  x: number
  y: number
}

export function shopEdges(entries: WarehouseEntry[]): ShopEdge[] {
  return entries.flatMap((entry) =>
    entry.content.recipeStatus === "VERIFIED"
      ? (entry.content.components ?? []).map((part) => ({
          from: part.itemId,
          to: entry.id,
          quantity: part.quantity,
        }))
      : [],
  )
}

/** Follow each direction independently, so sibling recipes are not included. */
export function selectedShopEdges(edges: ShopEdge[], selectedId: string | null) {
  if (!selectedId) return []
  const included = new Set<ShopEdge>()
  for (const direction of ["from", "to"] as const) {
    const visited = new Set<string>()
    const pending = [selectedId]
    while (pending.length) {
      const id = pending.pop()!
      if (visited.has(id)) continue
      visited.add(id)
      for (const edge of edges) {
        if (edge[direction] !== id) continue
        included.add(edge)
        pending.push(edge[direction === "from" ? "to" : "from"])
      }
    }
  }
  return [...included].map((edge) => ({ ...edge, direct: edge.to === selectedId }))
}

function positioned(position: ShopPosition): position is ShopPosition & { column: number; row: number } {
  return (
    position.column !== null &&
    Number.isInteger(position.column) &&
    position.column >= 0 &&
    position.row !== null &&
    Number.isInteger(position.row) &&
    position.row >= 0
  )
}

function categoryPosition(entry: WarehouseEntry, category: string) {
  return (entry.content.shopPositions ?? [])
    .filter(positioned)
    .filter((position) => position.categoryCode === category)
    .sort(
      (left, right) =>
        Number(!!left.variant) - Number(!!right.variant) || left.row - right.row || left.column - right.column,
    )[0]
}

/** Use authored coordinates; an item's tier never supplies a missing shop column. */
export function warehouseShopLayout(entries: WarehouseEntry[], category: string, selectedId: string | null) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  const edges = shopEdges(entries)
  const upgradeSources = new Set(edges.filter((edge) => byId.has(edge.to)).map((edge) => edge.from))
  const placements: ShopPlacement[] = []
  const unplaced: WarehouseEntry[] = []

  for (const entry of entries) {
    const positions = entry.content.shopPositions ?? []
    if (entry.content.categoryCode !== category && !positions.some((position) => position.categoryCode === category))
      continue

    const position = categoryPosition(entry, category)
    if (!position) {
      unplaced.push(entry)
      continue
    }
    placements.push({
      entry,
      column: position.column,
      row: position.row,
      terminal: position.column === 1 && (entry.content.tier ?? 0) >= 3 && !upgradeSources.has(entry.id),
    })
  }
  placements.sort(
    (left, right) =>
      left.column - right.column || left.row - right.row || left.entry.code.localeCompare(right.entry.code),
  )

  const related = new Set<string>(selectedId ? [selectedId] : [])
  for (const edge of selectedShopEdges(edges, selectedId)) {
    related.add(edge.from)
    related.add(edge.to)
  }
  const nativeIds = new Set([...placements.map(({ entry }) => entry.id), ...unplaced.map((entry) => entry.id)])
  const external: ShopExternal[] = []
  for (const entry of entries) {
    if (!related.has(entry.id) || nativeIds.has(entry.id)) continue
    const positions = (entry.content.shopPositions ?? []).filter(positioned)
    const preferred = [...positions].sort(
      (left, right) =>
        Number(left.categoryCode !== entry.content.categoryCode) -
          Number(right.categoryCode !== entry.content.categoryCode) ||
        Number(!!left.variant) - Number(!!right.variant) ||
        left.row - right.row,
    )[0]
    external.push({
      entry,
      column: preferred?.column ?? null,
      categoryCode: preferred?.categoryCode ?? entry.content.categoryCode ?? null,
    })
  }

  return { placements, external, unplaced, missingIds: [...related].filter((id) => !byId.has(id)) }
}

/** Preserve empty rows and frame only contiguous terminal rows, including isolated middle rows. */
export function shopColumnSections(placements: ShopPlacement[], column: number) {
  const rows = new Map<number, ShopPlacement[]>()
  for (const placement of placements) {
    if (placement.column !== column) continue
    const row = rows.get(placement.row) ?? []
    row.push(placement)
    rows.set(placement.row, row)
  }
  const sections: { terminal: boolean; rows: { row: number; placements: ShopPlacement[] }[] }[] = []
  const lastRow = rows.size ? Math.max(...rows.keys()) : -1
  for (let row = 0; row <= lastRow; row++) {
    const placed = rows.get(row) ?? []
    const terminal = placed.length > 0 && placed.every((placement) => placement.terminal)
    let section = sections.at(-1)
    if (!section || section.terminal !== terminal) {
      section = { terminal, rows: [] }
      sections.push(section)
    }
    section.rows.push({ row, placements: placed })
  }
  return sections
}

function intersectsCard(start: ShopPoint, end: ShopPoint, card: ShopCardRect) {
  return start.x === end.x
    ? start.x > card.left &&
        start.x < card.right &&
        Math.max(start.y, end.y) > card.top &&
        Math.min(start.y, end.y) < card.bottom
    : start.y > card.top &&
        start.y < card.bottom &&
        Math.max(start.x, end.x) > card.left &&
        Math.min(start.x, end.x) < card.right
}

/** Route orthogonal recipe arrows through free lanes, including same-column recipes. */
export function routeShopWire(
  source: ShopCardRect,
  target: ShopCardRect,
  cards: ShopCardRect[],
  lane = 0,
): ShopPoint[] | null {
  const gap = 8 + (lane % 3) * 3
  const start = { x: source.right, y: (source.top + source.bottom) / 2 }
  const end = { x: target.left - 3, y: (target.top + target.bottom) / 2 }
  const departure = { x: start.x + gap, y: start.y }
  const arrival = { x: end.x - gap, y: end.y }
  const obstacles = cards.map((card) => ({
    left: card.left - 3,
    right: card.right + 3,
    top: card.top - 3,
    bottom: card.bottom + 3,
  }))
  const xs = [
    ...new Set([departure.x, arrival.x, ...obstacles.flatMap((card) => [card.left - 4, card.right + 4])]),
  ].sort((left, right) => left - right)
  const ys = [
    ...new Set([departure.y, arrival.y, ...obstacles.flatMap((card) => [card.top - 4, card.bottom + 4])]),
  ].sort((left, right) => left - right)
  const key = (x: number, y: number) => y * xs.length + x
  const point = (index: number): ShopPoint => ({ x: xs[index % xs.length], y: ys[Math.floor(index / xs.length)] })
  const first = key(xs.indexOf(departure.x), ys.indexOf(departure.y))
  const last = key(xs.indexOf(arrival.x), ys.indexOf(arrival.y))
  const distances = new Map([[first, 0]])
  const previous = new Map<number, number>()
  const pending = [{ key: first, cost: 0 }]
  const visited = new Set<number>()

  while (pending.length) {
    pending.sort((left, right) => right.cost - left.cost)
    const current = pending.pop()!
    if (visited.has(current.key)) continue
    if (current.key === last) break
    visited.add(current.key)
    const ix = current.key % xs.length
    const iy = Math.floor(current.key / xs.length)
    const startPoint = point(current.key)
    for (const [x, y] of [
      [ix - 1, iy],
      [ix + 1, iy],
      [ix, iy - 1],
      [ix, iy + 1],
    ]) {
      if (x < 0 || y < 0 || x >= xs.length || y >= ys.length) continue
      const nextKey = key(x, y)
      const nextPoint = point(nextKey)
      if (obstacles.some((card) => intersectsCard(startPoint, nextPoint, card))) continue
      const distance =
        distances.get(current.key)! + Math.abs(startPoint.x - nextPoint.x) + Math.abs(startPoint.y - nextPoint.y)
      if (distance >= (distances.get(nextKey) ?? Infinity)) continue
      distances.set(nextKey, distance)
      previous.set(nextKey, current.key)
      pending.push({
        key: nextKey,
        cost: distance + Math.abs(nextPoint.x - arrival.x) + Math.abs(nextPoint.y - arrival.y),
      })
    }
  }
  if (!distances.has(last)) return null

  const route: ShopPoint[] = []
  for (let current: number | undefined = last; current !== undefined; current = previous.get(current))
    route.push(point(current))
  route.reverse()
  const simplified: ShopPoint[] = []
  for (const next of [start, ...route, end]) {
    while (simplified.length > 1) {
      const before = simplified.at(-2)!
      const lastPoint = simplified.at(-1)!
      if ((before.x === lastPoint.x && lastPoint.x === next.x) || (before.y === lastPoint.y && lastPoint.y === next.y))
        simplified.pop()
      else break
    }
    simplified.push(next)
  }
  return simplified
}
