import type { CompetitionView } from "@aov/community-contracts"

/** A season's name without the circuit it belongs to, for lists already grouped under that circuit. */
export function seasonName(name: string, circuit?: string | null) {
  if (!circuit || !name.toLowerCase().startsWith(circuit.toLowerCase())) return name
  const rest = name.slice(circuit.length).replace(/^[\s\-–—:·]+/, "")
  return rest || name
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
