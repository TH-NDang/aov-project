import type { ItemContent, WarehouseEntry } from "./warehouse-types"

type Entry = WarehouseEntry<ItemContent>

export function shopColumns(items: Entry[], current: number | null) {
  const count = Math.max(
    3,
    (current ?? -1) + 1,
    ...items.flatMap((item) => item.content.shopPositions.map((p) => (p.column ?? -1) + 1)),
  )
  return Array.from({ length: count }, (_, index) => index)
}

/** Keep physical shop coordinates and include the editor's unsaved positions. */
export function shopRowPeers(items: Entry[], entry: Entry, positionIndex: number) {
  const selected = entry.content.shopPositions[positionIndex]
  if (!selected || selected.column === null) return []
  return [...items.filter((item) => item.id !== entry.id), entry].flatMap((item) =>
    item.content.shopPositions.flatMap((position, index) =>
      (item.id !== entry.id || index !== positionIndex) &&
      position.categoryCode === selected.categoryCode &&
      position.column === selected.column &&
      (!selected.variant || !position.variant || position.variant === selected.variant) &&
      position.row !== null
        ? [{ item, positionIndex: index, row: position.row }]
        : [],
    ),
  )
}
