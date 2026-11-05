import { useCallback, useMemo, useSyncExternalStore } from "react"
import { useSearchParams } from "react-router"
import {
  itemMatchesStatFilters,
  itemReaderContent,
  itemStatFilterCounts,
  type ItemTextStat,
} from "@aov/ui/lib/item-description"
import { itemMatchesCategory, warehouseItemLayout } from "./warehouse-item-layout"
import {
  warehouseName,
  warehouseText,
  type PublishedWarehouseRecord,
  type WarehouseGroup,
  type WarehouseKind,
} from "./warehouse-types"

export type WarehouseItem = Extract<PublishedWarehouseRecord, { kind: "items" }>
export type ItemLayout = "shop" | "list"
export type ItemSort = "tier" | "price-desc" | "price-asc" | "name"

const SORTS: ItemSort[] = ["tier", "price-desc", "price-asc", "name"]

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query)
      list.addEventListener("change", notify)
      return () => list.removeEventListener("change", notify)
    },
    () => window.matchMedia(query).matches,
  )
}

/** Wide enough to read an entry beside the catalog instead of covering it. */
export const useDetailPanel = () => useMediaQuery("(min-width: 1400px)")

function compareItems(sort: ItemSort, locale: string) {
  const { compare } = new Intl.Collator(locale, { numeric: true, sensitivity: "base" })
  const name = (a: WarehouseItem, b: WarehouseItem) => compare(warehouseName(a, locale), warehouseName(b, locale))
  const price = (item: WarehouseItem) => item.content.price ?? -1
  return (a: WarehouseItem, b: WarehouseItem) => {
    if (sort === "name") return name(a, b)
    if (sort === "price-asc") return price(a) - price(b) || name(a, b)
    if (sort === "price-desc") return price(b) - price(a) || name(a, b)
    return (b.content.tier ?? 0) - (a.content.tier ?? 0) || price(b) - price(a) || name(a, b)
  }
}

/** The view of the item catalog: what is shown, how, and in which order the detail view steps through it. */
export function useItemCatalog({
  items,
  matches,
  groups,
  group,
  selected,
  locale,
}: {
  items: WarehouseItem[]
  /** Items left by the page search. */
  matches: WarehouseItem[]
  groups: WarehouseGroup[]
  group: string
  selected: WarehouseItem | undefined
  locale: string
}) {
  const [params, setParams] = useSearchParams()
  const narrow = useMediaQuery("(max-width: 767px)")
  const requested = params.get("layout")
  const layout: ItemLayout =
    !groups.length || requested === "list" || requested === "grid"
      ? "list"
      : requested === "shop" || !narrow
        ? "shop"
        : "list"
  const sortParam = params.get("sort") as ItemSort | null
  const sort: ItemSort = sortParam && SORTS.includes(sortParam) ? sortParam : "tier"
  const statsParam = params.get("stats") ?? ""
  const stats = useMemo(() => statsParam.split(",").filter(Boolean), [statsParam])
  const category = layout === "shop" ? group || selected?.content.categoryCode || groups[0]?.code || "" : group

  const statsById = useMemo(
    () =>
      new Map(
        items.map((item) => [
          item.id,
          itemReaderContent(item.content, warehouseText(item.content.translations, locale)).stats,
        ]),
      ),
    [items, locale],
  )
  const statsOf = useCallback((item: WarehouseItem): ItemTextStat[] => statsById.get(item.id) ?? [], [statsById])

  const visible = useMemo(
    () => matches.filter((item) => itemMatchesStatFilters(statsOf(item), stats)),
    [matches, statsOf, stats],
  )
  const inCategory = useCallback((item: WarehouseItem) => !category || itemMatchesCategory(item, category), [category])
  const counts = useMemo(
    () => itemStatFilterCounts(matches.filter(inCategory).map(statsOf), stats),
    [matches, inCategory, statsOf, stats],
  )
  const listed = useMemo(
    () => visible.filter(inCategory).sort(compareItems(sort, locale)),
    [visible, inCategory, sort, locale],
  )
  const order = useMemo(
    () =>
      layout === "shop" && category
        ? warehouseItemLayout(listed, category).flatMap((section) => section.entries)
        : listed,
    [layout, category, listed],
  )

  function change(key: string, value: string | null) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }

  return {
    layout,
    setLayout: (value: ItemLayout) => change("layout", value),
    sort,
    setSort: (value: ItemSort) => change("sort", value === "tier" ? null : value),
    stats,
    setStats: (value: string[]) => change("stats", value.join(",") || null),
    statsOf,
    counts,
    category,
    visible,
    listed,
    order,
  }
}

export type ItemCatalogView = ReturnType<typeof useItemCatalog>

const ARCANA_COLORS = ["RED", "PURPLE", "GREEN"]

/** Entries other than items, in roughly the order their catalog lays them out. */
export function warehouseReadingOrder(
  kind: WarehouseKind,
  entries: PublishedWarehouseRecord[],
  group: string,
  groups: WarehouseGroup[],
  params: URLSearchParams,
  locale: string,
): PublishedWarehouseRecord[] {
  const { compare } = new Intl.Collator(locale, { numeric: true, sensitivity: "base" })
  const name = (a: PublishedWarehouseRecord, b: PublishedWarehouseRecord) =>
    compare(warehouseName(a, locale), warehouseName(b, locale))
  if (kind === "arcana") {
    const color = params.get("color") || group
    const tier = params.get("tier")
    return entries
      .filter((entry) => entry.kind === "arcana")
      .filter((entry) => (!color || entry.content.color === color) && (!tier || entry.content.tier === Number(tier)))
      .sort(
        (a, b) =>
          ARCANA_COLORS.indexOf(a.content.color) - ARCANA_COLORS.indexOf(b.content.color) ||
          b.content.tier - a.content.tier ||
          name(a, b),
      )
  }
  if (kind === "enchantments") {
    const branch = (code: string) => groups.findIndex((candidate) => candidate.code === code)
    return entries
      .filter((entry) => entry.kind === "enchantments")
      .filter((entry) => !group || entry.content.branchCode === group)
      .sort(
        (a, b) =>
          branch(a.content.branchCode) - branch(b.content.branchCode) ||
          a.content.tier - b.content.tier ||
          (a.content.position ?? 0) - (b.content.position ?? 0) ||
          name(a, b),
      )
  }
  if (kind === "spells") {
    const retired = params.get("availability") === "REMOVED"
    return entries
      .filter((entry) => entry.kind === "spells")
      .filter((entry) => !retired || entry.content.availability === "REMOVED")
      .sort((a, b) => a.content.displayOrder - b.content.displayOrder || name(a, b))
  }
  return entries
}
