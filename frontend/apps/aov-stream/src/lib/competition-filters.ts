import type { CompetitionView } from "@aov/community-contracts"
import { isEnglishLocale, marketName } from "@aov/ui/lib/locale-text"
import { foldSearchText } from "@aov/ui/lib/search-text"
import { shortCompetitionName } from "./season-name.ts"

/** What competitions can be narrowed by; "all" (or an empty search) leaves a filter off. */
export type DirectoryFilter = { region: string; year: string; search: string }
export type FilterKey = Exclude<keyof DirectoryFilter, "search">

/** The value a competition has for one filter, or null. */
function valueOf({ content: { tournament } }: CompetitionView, key: FilterKey) {
  if (key === "region") return tournament.region || null
  return tournament.year != null ? String(tournament.year) : null
}

const FILTER_KEYS: FilterKey[] = ["region", "year"]

/** Whether a competition passes every filter but `except`, which lets a list count the options of that filter. */
export function passesFilter(view: CompetitionView, filter: DirectoryFilter, except?: FilterKey) {
  for (const key of FILTER_KEYS) {
    if (key === except || filter[key] === "all") continue
    if (valueOf(view, key) !== filter[key]) return false
  }
  const needle = foldSearchText(filter.search.trim())
  if (!needle) return true
  const { tournament, plan, circuit, organizer } = view.content
  return foldSearchText(
    [
      tournament.name,
      shortCompetitionName(view),
      plan.circuit,
      plan.organizer,
      circuit?.name,
      circuit?.shortName,
      organizer?.name,
    ]
      .filter(Boolean)
      .join(" "),
  ).includes(needle)
}

/**
 * The options of one filter with how many competitions each would show, given the other filters. Options keep the
 * order `order` gives; the option in use stays even when nothing matches it, so the select never loses its value.
 */
export function filterOptions(
  items: CompetitionView[],
  filter: DirectoryFilter,
  key: FilterKey,
  order: (a: [string, number], b: [string, number]) => number,
) {
  const counts = new Map<string, number>()
  for (const view of items) {
    if (!passesFilter(view, filter, key)) continue
    const value = valueOf(view, key)
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  if (filter[key] !== "all" && !counts.has(filter[key])) counts.set(filter[key], 0)
  return [...counts].sort(order)
}

const REGIONS: Record<string, readonly [string, string]> = {
  ASIA: ["Châu Á", "Asia"],
  SEA: ["Đông Nam Á", "Southeast Asia"],
  EU: ["Châu Âu", "Europe"],
  MENA: ["Trung Đông và Bắc Phi", "Middle East and North Africa"],
}
/** Whether a region is many countries rather than one. */
export const isArea = (code: string) => code === "GLOBAL" || code in REGIONS

const regionNames = new Map<string, Intl.DisplayNames>()

/** A competition's region in the reader's language: a game market, an area such as Southeast Asia, or a country. */
export function competitionRegionName(code: string, locale: string) {
  const area = REGIONS[code]
  if (area) return isEnglishLocale(locale) ? area[1] : area[0]
  const market = marketName(code, locale)
  if (market !== code || !/^[A-Z]{2}$/.test(code)) return market
  let names = regionNames.get(locale)
  if (!names) {
    names = new Intl.DisplayNames([locale], { type: "region", style: "short" })
    regionNames.set(locale, names)
  }
  return names.of(code) || code
}
