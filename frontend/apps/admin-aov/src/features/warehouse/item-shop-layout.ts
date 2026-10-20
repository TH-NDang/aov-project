import { itemEdges, selectedItemEdges } from "./item-graph"
import type { ItemContent, WarehouseEntry } from "./warehouse-types"

type Entry = WarehouseEntry<ItemContent>
type ShopPosition = ItemContent["shopPositions"][number]

export interface ItemShopPlacement {
  item: Entry
  position: ShopPosition
  index: number
  terminal: boolean
}

export interface ExternalItemShopPlacement {
  item: Entry
  position: ShopPosition | null
  index: number
  categoryCode: string | null
}

export interface ItemShopLayout {
  placements: ItemShopPlacement[]
  external: ExternalItemShopPlacement[]
  missingIds: string[]
}

export interface ItemShopRow {
  row: number
  placements: ItemShopPlacement[]
}

export interface ItemShopSection {
  terminal: boolean
  rows: ItemShopRow[]
}

function compatible(position: ShopPosition, variant: string) {
  return !variant || !position.variant || position.variant === variant
}

function validCoordinate(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 0
}

/** Frame contiguous terminal rows without changing the shop's canonical row coordinates. */
export function itemShopSections(placements: ItemShopPlacement[], column: number): ItemShopSection[] {
  if (!validCoordinate(column)) return []
  const byRow = new Map<number, ItemShopPlacement[]>()
  for (const placement of placements) {
    const position = placement.position
    if (!validCoordinate(position.column) || position.column !== column || !validCoordinate(position.row)) continue
    const entries = byRow.get(position.row) ?? []
    entries.push(placement)
    byRow.set(position.row, entries)
  }
  const lastRow = byRow.size ? Math.max(...byRow.keys()) : 2
  const sections: ItemShopSection[] = []
  for (let row = 0; row <= lastRow; row++) {
    const entries = byRow.get(row) ?? []
    const terminal = entries.length > 0 && entries.every((placement) => placement.terminal)
    let section = sections.at(-1)
    if (!section || section.terminal !== terminal) {
      section = { terminal, rows: [] }
      sections.push(section)
    }
    section.rows.push({ row, placements: entries })
  }
  return sections
}

/** Keep shop coordinates independent from tier and expose related items from other categories once. */
export function itemShopLayout(
  items: Entry[],
  selectedId: string | null,
  category: string,
  variant = "",
): ItemShopLayout {
  const byId = new Map(items.map((item) => [item.id, item]))
  const edges = itemEdges(items)
  const upgrades = new Set(edges.filter((edge) => byId.has(edge.to)).map((edge) => edge.from))
  const placements = items.flatMap((item) =>
    item.content.shopPositions.flatMap((position, index) =>
      position.categoryCode === category && compatible(position, variant)
        ? [
            {
              item,
              position,
              index,
              terminal: position.column === 1 && (item.content.tier ?? 0) >= 3 && !upgrades.has(item.id),
            },
          ]
        : [],
    ),
  )

  const related = new Set<string>()
  if (selectedId) related.add(selectedId)
  for (const edge of selectedItemEdges(edges, selectedId)) {
    related.add(edge.from)
    related.add(edge.to)
  }
  const nativeIds = new Set(placements.map(({ item }) => item.id))
  const external = items.flatMap((item): ExternalItemShopPlacement[] => {
    if (!related.has(item.id) || nativeIds.has(item.id)) return []
    const candidates = item.content.shopPositions
      .map((position, index) => ({ position, index }))
      .filter(({ position }) => compatible(position, variant))
    const valid = candidates.filter(({ position }) => validCoordinate(position.column) && validCoordinate(position.row))
    const preferred = (candidates: typeof valid) =>
      candidates.find(({ position }) => position.categoryCode === item.content.categoryCode) ?? candidates[0]
    const source = preferred(valid) ?? preferred(candidates)
    return [
      {
        item,
        position: source?.position ?? null,
        index: source?.index ?? -1,
        categoryCode: source?.position.categoryCode ?? item.content.categoryCode ?? null,
      },
    ]
  })
  return { placements, external, missingIds: [...related].filter((id) => !byId.has(id)) }
}
