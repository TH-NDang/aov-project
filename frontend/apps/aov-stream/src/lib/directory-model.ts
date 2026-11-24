import type { CompetitionView } from "@aov/community-contracts"
import { competitionChampion } from "./champion-model.ts"
import { byRecency, bySoonest, competitionStatus } from "./competition-model.ts"
import { daysUntil } from "./countdown.ts"

/**
 * What is on, then what starts next, soonest first, then what is announced. An event still marked as coming after its
 * last day is neither.
 */
export function aheadCompetitions(views: CompetitionView[], now = Date.now()) {
  const order = ["ONGOING", "UPCOMING", "ANNOUNCED"]
  const rank = (view: CompetitionView) => {
    const { tournament, plan } = view.content
    const left = daysUntil(tournament.endsOn ?? tournament.startsOn, now, plan.timezone)
    if (left != null && left < 0) return -1
    return order.indexOf(competitionStatus(view.content, now) ?? "")
  }
  return views
    .filter((view) => rank(view) >= 0)
    .sort((a, b) => rank(a) - rank(b) || (rank(a) === 0 ? byRecency(a, b) : bySoonest(a, b)))
}

export type SeasonRow = {
  view: CompetitionView
  /** Listed under its main event: the event's qualifier, wildcard or show match. */
  part: boolean
}

export type CircuitGroup = {
  key: string
  /** The competitions outside any circuit, and those alone in theirs. */
  other: boolean
  rows: SeasonRow[]
}

/** Seasons newest first, each followed by the parts of it that are in the list. */
export function seasonRows(views: CompetitionView[]): SeasonRow[] {
  const sorted = [...views].sort(byRecency)
  const ids = new Set(sorted.map((view) => view.id))
  const parentOf = (view: CompetitionView) => {
    const parent = view.content.tournament.parentTournamentId
    return parent && parent !== view.id && ids.has(parent) ? parent : null
  }
  return sorted
    .filter((view) => !parentOf(view))
    .flatMap((view) => [
      { view, part: false },
      ...sorted.filter((item) => parentOf(item) === view.id).map((item) => ({ view: item, part: true })),
    ])
}

/** The seasons of a circuit with a known champion, newest first; the parts of a season crown none of their own. */
export function circuitChampions(group: CircuitGroup) {
  return group.rows
    .filter((row) => !row.part && competitionStatus(row.view.content) === "FINISHED" && competitionChampion(row.view))
    .map((row) => row.view)
}

/** The years a circuit spans, such as "2020–2026". */
export function circuitYears(views: CompetitionView[]) {
  const years = views.flatMap(({ content }) => {
    const { year, startsOn } = content.tournament
    const value = year ?? Number(startsOn?.slice(0, 4))
    return value ? [value] : []
  })
  if (!years.length) return ""
  const [first, last] = [Math.min(...years), Math.max(...years)]
  return first === last ? String(first) : `${first}–${last}`
}

/** Competitions by circuit, the circuit with the newest season first; those outside any circuit close the list. */
export function circuitGroups(views: CompetitionView[]): CircuitGroup[] {
  const circuits = new Map<string, CompetitionView[]>()
  for (const view of [...views].sort(byRecency)) {
    const key = view.content.circuit?.id || view.content.plan.circuit || ""
    circuits.set(key, [...(circuits.get(key) ?? []), view])
  }
  const groups: CircuitGroup[] = []
  const rest: CompetitionView[] = []
  for (const [key, list] of circuits) {
    if (!key || list.length === 1) rest.push(...list)
    else groups.push({ key, other: false, rows: seasonRows(list) })
  }
  if (rest.length) groups.push({ key: "other", other: true, rows: seasonRows(rest) })
  return groups
}
