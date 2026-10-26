import type { WarehouseContent, WarehouseEntry } from "./warehouse-types"

type ShopPosition = NonNullable<WarehouseContent["shopPositions"]>[number]

export interface WarehouseItemSection {
  key: string
  kind: "tier" | "column" | "unplaced"
  value: number
  entries: WarehouseEntry[]
}

export function itemMatchesCategory(entry: WarehouseEntry, category: string) {
  return (
    entry.content.categoryCode === category ||
    !!entry.content.shopPositions?.some((position) => position.categoryCode === category)
  )
}

function hasCoordinates(position: ShopPosition): position is ShopPosition & { row: number; column: number } {
  return (
    position.row !== null &&
    Number.isInteger(position.row) &&
    position.row >= 0 &&
    position.column !== null &&
    Number.isInteger(position.column) &&
    position.column >= 0
  )
}

function categoryPosition(entry: WarehouseEntry, category: string) {
  return (entry.content.shopPositions ?? [])
    .filter(hasCoordinates)
    .filter((position) => position.categoryCode === category)
    .sort(
      (left, right) =>
        Number(!!left.variant) - Number(!!right.variant) || left.column - right.column || left.row - right.row,
    )[0]
}

export function warehouseItemLayout(entries: WarehouseEntry[], category: string): WarehouseItemSection[] {
  if (!category) {
    const tiers = [...new Set(entries.map((entry) => entry.content.tier ?? 0))].sort((left, right) => left - right)
    return tiers.map((tier) => ({
      key: `tier-${tier}`,
      kind: "tier",
      value: tier,
      entries: entries.filter((entry) => (entry.content.tier ?? 0) === tier),
    }))
  }

  const positioned = entries
    .filter((entry) => itemMatchesCategory(entry, category))
    .map((entry) => ({
      entry,
      position: categoryPosition(entry, category),
    }))
  const placed = positioned.flatMap(({ entry, position }) => (position ? [{ entry, position }] : []))
  const columns = [...new Set(placed.map(({ position }) => position.column))].sort((left, right) => left - right)
  const sections: WarehouseItemSection[] = columns.map((column) => ({
    key: `column-${column}`,
    kind: "column",
    value: column,
    entries: placed
      .filter(({ position }) => position.column === column)
      .sort((left, right) => left.position.row - right.position.row || left.entry.code.localeCompare(right.entry.code))
      .map(({ entry }) => entry),
  }))
  const unplaced = positioned.filter(({ position }) => !position).map(({ entry }) => entry)
  if (unplaced.length) sections.push({ key: "unplaced", kind: "unplaced", value: 0, entries: unplaced })
  return sections
}
