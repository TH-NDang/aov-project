import type { CompetitionView } from "@aov/community-contracts"

/** A season's name without the circuit it belongs to, for lists already grouped under that circuit. */
export function seasonName(name: string, circuit?: string | null) {
  if (!circuit || !name.toLowerCase().startsWith(circuit.toLowerCase())) return name
  const rest = name.slice(circuit.length).replace(/^[\s\-–—:·]+/, "")
  return rest || name
}

/** A part's name under the season it belongs to: without the season's name, or else without the circuit's and the year. */
export function partName(part: string, season: string, circuit: string | null, year: number) {
  const short = seasonName(part, season)
  return short === part ? seasonOfYear(seasonName(part, circuit), year) || part : short
}

/** A season's name on a page of one year, which then needs no year of its own. */
export function seasonOfYear(name: string, year: number) {
  return name
    .replace(new RegExp(`\\b${year}\\b`), "")
    .replace(/^[\s\-–—:·]+|[\s\-–—:·]+$/g, "")
    .replace(/\s{2,}/g, " ")
}

/**
 * A competition's name in short, such as "AIC 2026": its circuit's short name and the season. A competition whose
 * circuit has none, or whose name does not start with the circuit's, keeps its whole name.
 */
export function shortCompetitionName(view: CompetitionView) {
  const { tournament, circuit } = view.content
  const season = seasonName(tournament.name, circuit?.name)
  return circuit?.shortName && season !== tournament.name ? `${circuit.shortName} ${season}` : tournament.name
}
