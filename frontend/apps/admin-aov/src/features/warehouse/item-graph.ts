import type { ItemContent, WarehouseEntry } from "./warehouse-types"

export interface Point {
  x: number
  y: number
}
export interface CardRect {
  left: number
  right: number
  top: number
  bottom: number
}
export interface ItemEdge {
  from: string
  to: string
  quantity: number
}
export function itemEdges(items: WarehouseEntry<ItemContent>[]): ItemEdge[] {
  return items.flatMap((item) =>
    item.content.recipeStatus === "VERIFIED"
      ? item.content.components.map((part) => ({ from: part.itemId, to: item.id, quantity: part.quantity }))
      : [],
  )
}
export function relatedItemEdges(edges: ItemEdge[], selected: string): ItemEdge[] {
  const included = new Set<ItemEdge>()
  for (const direction of ["from", "to"] as const) {
    const seen = new Set<string>(),
      queue = [selected]
    while (queue.length) {
      const id = queue.pop()!
      if (seen.has(id)) continue
      seen.add(id)
      for (const edge of edges)
        if (edge[direction] === id) {
          included.add(edge)
          queue.push(edge[direction === "from" ? "to" : "from"])
        }
    }
  }
  return [...included]
}

export function selectedItemEdges(edges: ItemEdge[], selected: string | null) {
  return selected ? relatedItemEdges(edges, selected).map((edge) => ({ ...edge, direct: edge.to === selected })) : []
}
/** Adding an ingredient must not introduce a cycle into the direct recipe graph. */
export function recipeConnectionError(items: WarehouseEntry<ItemContent>[], from: string, to: string): string | null {
  if (from === to) return "Không thể nối trang bị với chính nó."
  const byId = new Map(items.map((item) => [item.id, item]))
  if (!byId.has(from) || !byId.has(to)) return "Trang bị không còn trong bộ quy tắc này."
  const seen = new Set<string>(),
    queue = [from]
  while (queue.length) {
    const id = queue.pop()!
    if (id === to) return "Đường nối này tạo vòng lặp trong công thức."
    if (seen.has(id)) continue
    seen.add(id)
    queue.push(...(byId.get(id)?.content.components.map((part) => part.itemId) ?? []))
  }
  return null
}
export function crossesCard(a: Point, b: Point, card: CardRect): boolean {
  return a.x === b.x
    ? a.x > card.left && a.x < card.right && Math.max(a.y, b.y) > card.top && Math.min(a.y, b.y) < card.bottom
    : a.y > card.top && a.y < card.bottom && Math.max(a.x, b.x) > card.left && Math.min(a.x, b.x) < card.right
}
/** Route orthogonal wires through free lanes, never through another item card. */
export function routeItemWire(
  source: CardRect,
  target: CardRect,
  cards: CardRect[],
  lane = 0,
  portGap = 0,
): Point[] | null {
  const gap = 8 + (lane % 4) * 4
  const start = { x: source.right + portGap, y: (source.top + source.bottom) / 2 }
  const end = { x: target.left - portGap, y: (target.top + target.bottom) / 2 }
  const a = { x: start.x + gap, y: start.y },
    b = { x: end.x - gap, y: end.y }
  const obstacles = cards.map((r) => ({ left: r.left - 4, right: r.right + 4, top: r.top - 4, bottom: r.bottom + 4 }))
  const xs = [...new Set([a.x, b.x, ...obstacles.flatMap((r) => [r.left - 4, r.right + 4])])].sort((x, y) => x - y)
  const ys = [...new Set([a.y, b.y, ...obstacles.flatMap((r) => [r.top - 4, r.bottom + 4])])].sort((x, y) => x - y)
  const key = (x: number, y: number) => y * xs.length + x
  const point = (k: number): Point => ({ x: xs[k % xs.length], y: ys[Math.floor(k / xs.length)] })
  const first = key(xs.indexOf(a.x), ys.indexOf(a.y)),
    last = key(xs.indexOf(b.x), ys.indexOf(b.y))
  const distance = new Map([[first, 0]]),
    previous = new Map<number, number>(),
    queue = [{ key: first, cost: 0 }],
    closed = new Set<number>()
  while (queue.length) {
    queue.sort((u, v) => v.cost - u.cost)
    const { key: k } = queue.pop()!
    if (closed.has(k)) continue
    if (k === last) break
    closed.add(k)
    const ix = k % xs.length,
      iy = Math.floor(k / xs.length),
      p = point(k)
    for (const [x, y] of [
      [ix - 1, iy],
      [ix + 1, iy],
      [ix, iy - 1],
      [ix, iy + 1],
    ]) {
      if (x < 0 || y < 0 || x >= xs.length || y >= ys.length) continue
      const n = key(x, y),
        q = point(n)
      if (obstacles.some((r) => crossesCard(p, q, r))) continue
      const d = distance.get(k)! + Math.abs(p.x - q.x) + Math.abs(p.y - q.y)
      if (d < (distance.get(n) ?? Infinity)) {
        distance.set(n, d)
        previous.set(n, k)
        queue.push({ key: n, cost: d + Math.abs(q.x - b.x) + Math.abs(q.y - b.y) })
      }
    }
  }
  if (!distance.has(last)) return null
  const path: Point[] = []
  for (let k: number | undefined = last; k !== undefined; k = previous.get(k)) path.push(point(k))
  path.reverse()
  const clean: Point[] = []
  for (const p of [start, ...path, end]) {
    while (clean.length > 1) {
      const u = clean.at(-2)!,
        v = clean.at(-1)!
      if ((u.x === v.x && v.x === p.x) || (u.y === v.y && v.y === p.y)) clean.pop()
      else break
    }
    clean.push(p)
  }
  return clean
}
