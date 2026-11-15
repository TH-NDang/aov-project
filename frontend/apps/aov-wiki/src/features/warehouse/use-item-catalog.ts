import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router"
import { arcanaCombatGroup } from "@aov/ui/lib/arcana-stat-colors"
import {
  itemMatchesStatFilters,
  itemReaderContent,
  itemStatFilterCounts,
  type ItemTextStat,
} from "@aov/ui/lib/item-description"
import { itemMatchesCategory, warehouseItemLayout } from "./warehouse-item-layout"
import { NARROW_ITEM_LAYOUT, preferredItemLayout, useMediaQuery, type ItemLayout } from "./warehouse-layout"
import {
  warehouseName,
  warehouseText,
  type PublishedWarehouseRecord,
  type WarehouseGroup,
  type WarehouseKind,
} from "./warehouse-types"

export type WarehouseItem = Extract<PublishedWarehouseRecord, { kind: "items" }>
export type WarehouseArcana = Extract<PublishedWarehouseRecord, { kind: "arcana" }>
export type WarehouseEnchantment = Extract<PublishedWarehouseRecord, { kind: "enchantments" }>
export type WarehouseSpell = Extract<PublishedWarehouseRecord, { kind: "spells" }>
export type ItemSort = "tier" | "price-desc" | "price-asc" | "name"

const SORTS: ItemSort[] = ["tier", "price-desc", "price-asc", "name"]

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
  const preferred = preferredItemLayout(params.get("layout"), useMediaQuery(NARROW_ITEM_LAYOUT))
  // The board is drawn per shop group, so it waits for the groups; until then the items read as a list.
  const layout: ItemLayout = groups.length ? preferred : "list"
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
    preferred,
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

export const ARCANA_COLORS = ["RED", "PURPLE", "GREEN"] as const
export type ArcanaColor = (typeof ARCANA_COLORS)[number]
export const ARCANA_FAMILIES = ["physical", "magic", "neutral"] as const
export type ArcanaFamily = (typeof ARCANA_FAMILIES)[number]

/** The arcana filters as the address carries them; an old link may still name the color as `group`. */
export function arcanaFilters(params: URLSearchParams, group: string) {
  return { color: params.get("color") || group, tier: params.get("tier") ?? "", stat: params.get("stat") ?? "" }
}

/** Arcana left by the color and tier filters: the stats on offer are read from these. */
export function arcanaCandidates(entries: PublishedWarehouseRecord[], filters: { color: string; tier: string }) {
  return entries
    .filter((entry): entry is WarehouseArcana => entry.kind === "arcana")
    .filter(
      (entry) =>
        (!filters.color || entry.content.color === filters.color) &&
        (!filters.tier || entry.content.tier === Number(filters.tier)),
    )
}

/** The arcana on screen in reading order: highest tier first, then color, then what the stats serve, then name. */
export function arcanaRows(
  entries: PublishedWarehouseRecord[],
  filters: { color: string; tier: string; stat: string },
  locale: string,
) {
  const { compare } = new Intl.Collator(locale, { numeric: true, sensitivity: "base" })
  return arcanaCandidates(entries, filters)
    .filter((entry) => !filters.stat || entry.content.stats.some((stat) => stat.key === filters.stat))
    .map((entry) => ({ entry, family: arcanaCombatGroup(entry.content) }))
    .sort(
      (a, b) =>
        b.entry.content.tier - a.entry.content.tier ||
        ARCANA_COLORS.indexOf(a.entry.content.color) - ARCANA_COLORS.indexOf(b.entry.content.color) ||
        ARCANA_FAMILIES.indexOf(a.family) - ARCANA_FAMILIES.indexOf(b.family) ||
        compare(warehouseName(a.entry, locale), warehouseName(b.entry, locale)),
    )
}

/** Enchantments in reading order: branch, then tier, then the place within the tier. */
export function enchantmentRows(
  entries: PublishedWarehouseRecord[],
  group: string,
  groups: WarehouseGroup[],
  locale: string,
) {
  const { compare } = new Intl.Collator(locale, { numeric: true, sensitivity: "base" })
  const known = groups.map((branch) => branch.code)
  // A branch the catalog does not describe yet still shows its enchantments, after the known ones.
  const branch = (code: string) => (known.includes(code) ? known.indexOf(code) : known.length)
  return entries
    .filter((entry): entry is WarehouseEnchantment => entry.kind === "enchantments")
    .filter((entry) => !group || entry.content.branchCode === group)
    .sort(
      (a, b) =>
        branch(a.content.branchCode) - branch(b.content.branchCode) ||
        a.content.branchCode.localeCompare(b.content.branchCode) ||
        a.content.tier - b.content.tier ||
        (a.content.position ?? 999) - (b.content.position ?? 999) ||
        compare(warehouseName(a, locale), warehouseName(b, locale)),
    )
}

export const isRetiredSpell = (entry: WarehouseSpell) =>
  !!entry.content.legacy || entry.content.availability === "REMOVED"

/** Talents in the game's own order, the ones still in the game first. */
export function spellRows(entries: PublishedWarehouseRecord[], locale: string) {
  const { compare } = new Intl.Collator(locale, { numeric: true, sensitivity: "base" })
  return entries
    .filter((entry): entry is WarehouseSpell => entry.kind === "spells")
    .sort(
      (a, b) =>
        Number(isRetiredSpell(a)) - Number(isRetiredSpell(b)) ||
        a.content.displayOrder - b.content.displayOrder ||
        compare(warehouseName(a, locale), warehouseName(b, locale)),
    )
}

/** Entries other than items, in the order their catalog lays them out. */
export function warehouseReadingOrder(
  kind: WarehouseKind,
  entries: PublishedWarehouseRecord[],
  group: string,
  groups: WarehouseGroup[],
  params: URLSearchParams,
  locale: string,
): PublishedWarehouseRecord[] {
  if (kind === "arcana") return arcanaRows(entries, arcanaFilters(params, group), locale).map(({ entry }) => entry)
  if (kind === "enchantments") return enchantmentRows(entries, group, groups, locale)
  if (kind === "spells") return spellRows(entries, locale)
  return entries
}
