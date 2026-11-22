import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router"
import { arcanaCombatGroup } from "@aov/ui/lib/arcana-stat-colors"
import {
  ITEM_STAT_FILTERS,
  itemCardStats,
  itemFilterStats,
  itemMatchesStatFilters,
  itemStatDefinitionByCode,
  itemReaderContent,
  itemStatFilterCounts,
  type ItemTextStat,
} from "@aov/ui/lib/item-description"
import { itemMatchesCategory, warehouseItemLayout } from "./warehouse-item-layout"
import { useMediaQuery } from "../../lib/use-media-query"
import { NARROW_ITEM_LAYOUT, preferredItemLayout, type ItemLayout } from "./warehouse-layout"
import {
  warehouseName,
  warehouseText,
  type PublishedWarehouseRecord,
  type WarehouseGroup,
  type WarehouseKind,
} from "../../lib/warehouse-types"

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

  const readingById = useMemo(
    () =>
      new Map(
        items.map((item) => [
          item.id,
          itemReaderContent(item.content, warehouseText(item.content.translations, locale), locale),
        ]),
      ),
    [items, locale],
  )
  const statsOf = useCallback(
    (item: WarehouseItem): ItemTextStat[] => {
      const reading = readingById.get(item.id)
      return reading ? itemCardStats(reading) : []
    },
    [readingById],
  )
  // The filters also count the stats an effect grants, such as the magic pierce of a passive.
  const filterStatsOf = useCallback(
    (item: WarehouseItem) => {
      const reading = readingById.get(item.id)
      return reading ? itemFilterStats(reading) : []
    },
    [readingById],
  )

  const visible = useMemo(
    () => matches.filter((item) => itemMatchesStatFilters(filterStatsOf(item), stats)),
    [matches, filterStatsOf, stats],
  )
  const inCategory = useCallback((item: WarehouseItem) => !category || itemMatchesCategory(item, category), [category])
  const counts = useMemo(
    () => itemStatFilterCounts(matches.filter(inCategory).map(filterStatsOf), stats),
    [matches, inCategory, filterStatsOf, stats],
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

/**
 * The arcana filters as the address carries them; an old link may still name the color as `group`. The stats are the
 * stat filters of the item catalog (`stats=`), so both catalogs filter the same way.
 */
export function arcanaFilters(params: URLSearchParams, group: string) {
  return {
    color: params.get("color") || group,
    tier: params.get("tier") ?? "",
    stats: (params.get("stats") ?? "").split(",").filter(Boolean),
  }
}

export type ArcanaFilters = ReturnType<typeof arcanaFilters>

/** An arcana's stats as the stat filters name them. */
export function arcanaFilterStats(entry: WarehouseArcana) {
  return entry.content.stats.flatMap((stat) => {
    const key = itemStatDefinitionByCode(stat.key)?.key
    return key ? [{ key }] : []
  })
}

/** The stat codes the chosen stat filters cover, such as both kinds of life steal for "lifesteal". */
export function arcanaChosenCodes(filters: readonly string[]) {
  return new Set(
    ITEM_STAT_FILTERS.filter((filter) => filters.includes(filter.key))
      .flatMap((filter) => filter.stats)
      .flatMap((key) => itemStatDefinitionByCode(key)?.code ?? []),
  )
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

/** How many arcana each stat filter would leave, beside the stat filters already chosen. */
export function arcanaStatCounts(entries: PublishedWarehouseRecord[], filters: ArcanaFilters) {
  return itemStatFilterCounts(arcanaCandidates(entries, filters).map(arcanaFilterStats), filters.stats)
}

/** The arcana on screen in reading order: highest tier first, then color, then what the stats serve, then name. */
export function arcanaRows(entries: PublishedWarehouseRecord[], filters: ArcanaFilters, locale: string) {
  const { compare } = new Intl.Collator(locale, { numeric: true, sensitivity: "base" })
  // With a stat chosen, the reader is comparing it: the most of the first one chosen comes first.
  const compared = arcanaChosenCodes(filters.stats.slice(0, 1))
  const amount = (entry: WarehouseArcana) =>
    entry.content.stats.reduce((total, stat) => total + (compared.has(stat.key) ? stat.value : 0), 0)
  return arcanaCandidates(entries, filters)
    .filter((entry) => itemMatchesStatFilters(arcanaFilterStats(entry), filters.stats))
    .map((entry) => ({ entry, family: arcanaCombatGroup(entry.content) }))
    .sort(
      (a, b) =>
        b.entry.content.tier - a.entry.content.tier ||
        ARCANA_COLORS.indexOf(a.entry.content.color) - ARCANA_COLORS.indexOf(b.entry.content.color) ||
        amount(b.entry) - amount(a.entry) ||
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
