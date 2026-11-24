import type { CompetitionView, TournamentContent } from "@aov/community-contracts"
import { isEnglishLocale, marketName } from "@aov/ui/lib/locale-text"
import { foldSearchText } from "@aov/ui/lib/search-text"
import { competitionStatus } from "./competition-model.ts"

/** What the competition directory can be narrowed by; "all" (or an empty search) leaves a filter off. */
export type DirectoryFilter = {
  region: string
  year: string
  status: string
  tier: string
  kind: string
  search: string
}
export type FilterKey = Exclude<keyof DirectoryFilter, "search">

/**
 * What kind of event a competition is: a main event stands on its own, a qualifier or a show match belongs to one.
 * A competition can be more than one at once, such as a qualifier recorded without its main event.
 */
export type CompetitionKind = "MAIN" | "QUALIFIER" | "SHOWMATCH"
export const COMPETITION_KINDS: CompetitionKind[] = ["MAIN", "QUALIFIER", "SHOWMATCH"]
export const COMPETITION_KIND_NAMES: Record<CompetitionKind, readonly [string, string]> = {
  MAIN: ["Giải chính", "Main events"],
  QUALIFIER: ["Vòng loại", "Qualifiers"],
  SHOWMATCH: ["Giao hữu", "Show matches"],
}

export function competitionKinds(tournament: TournamentContent): CompetitionKind[] {
  const kinds: CompetitionKind[] = []
  if (!tournament.parentTournamentId && tournament.competitionType !== "SHOWMATCH") kinds.push("MAIN")
  if (tournament.competitionType === "QUALIFIER") kinds.push("QUALIFIER")
  if (tournament.competitionType === "SHOWMATCH") kinds.push("SHOWMATCH")
  return kinds
}

/** The value a competition has for one filter; a competition may have several kinds. */
function valuesOf(view: CompetitionView, key: FilterKey): string[] {
  const { tournament, plan } = view.content
  if (key === "region") return tournament.region ? [tournament.region] : []
  if (key === "year") return tournament.year != null ? [String(tournament.year)] : []
  if (key === "status") {
    const status = competitionStatus({ tournament, plan })
    return status ? [status] : []
  }
  if (key === "tier") return tournament.tier && tournament.tier !== "UNKNOWN" ? [tournament.tier] : []
  return competitionKinds(tournament)
}

const FILTER_KEYS: FilterKey[] = ["region", "year", "status", "tier", "kind"]

/** Whether a competition passes every filter but `except`, which lets a list count the options of that filter. */
export function passesFilter(view: CompetitionView, filter: DirectoryFilter, except?: FilterKey) {
  for (const key of FILTER_KEYS) {
    if (key === except || filter[key] === "all") continue
    if (!valuesOf(view, key).includes(filter[key])) return false
  }
  const needle = foldSearchText(filter.search.trim())
  if (!needle) return true
  const { tournament, plan, circuit, organizer } = view.content
  return foldSearchText(
    [tournament.name, plan.circuit, plan.organizer, circuit?.name, organizer?.name].filter(Boolean).join(" "),
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
    for (const value of valuesOf(view, key)) counts.set(value, (counts.get(value) ?? 0) + 1)
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
