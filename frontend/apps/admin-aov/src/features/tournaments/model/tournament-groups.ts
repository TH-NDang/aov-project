import type { DocumentView, TournamentContent } from "@aov/community-contracts"
import { statusConflict } from "./tournament-status"

type Entry = DocumentView<TournamentContent>

/** The circuit a tournament's plan names: its page, or only the name while no page is linked. */
export type CircuitRef = { id: string; name: string }

/** The seasons of one circuit in the order of the list. Without a circuit: the tournaments that stand alone. */
export type TournamentGroup = { key: string; circuit: CircuitRef | null; entries: Entry[] }

/** A group as the list draws it: the seasons on screen, how many wait behind "show more", and what all seasons share. */
export type FoldedGroup = TournamentGroup & {
  total: number
  hidden: number
  foldable: boolean
  years: string
  region: string | null
}

export const ALONE = "alone"
/** Seasons a circuit shows before the rest fold away. */
export const SEASONS_SHOWN = 3

/**
 * Tournaments by circuit, the circuit of the first tournament first. Those outside any circuit, and those alone in
 * theirs, close the list together.
 */
export function circuitGroups(entries: readonly Entry[], circuitOf: ReadonlyMap<string, CircuitRef>) {
  const groups = new Map<string, TournamentGroup>()
  for (const entry of entries) {
    const circuit = circuitOf.get(entry.id) ?? null
    const key = circuit?.id ?? ALONE
    const group = groups.get(key)
    if (group) group.entries.push(entry)
    else groups.set(key, { key, circuit, entries: [entry] })
  }
  const all = [...groups.values()]
  const isAlone = (group: TournamentGroup) => !group.circuit || group.entries.length === 1
  const order = new Map(entries.map((entry, index) => [entry.id, index]))
  const alone = all
    .filter(isAlone)
    .flatMap((group) => group.entries)
    .sort((a, b) => order.get(a.id)! - order.get(b.id)!)
  const circuits = all.filter((group) => !isAlone(group))
  return alone.length ? [...circuits, { key: ALONE, circuit: null, entries: alone }] : circuits
}

/** Each group cut to its first seasons unless it is open; a single season left over is not worth folding away. */
export function foldGroups(
  groups: readonly TournamentGroup[],
  isOpen: (key: string) => boolean,
  limit = SEASONS_SHOWN,
): FoldedGroup[] {
  return groups.map((group) => {
    const total = group.entries.length
    const foldable = total > limit + 1
    const shown = foldable && !isOpen(group.key) ? limit : total
    return {
      ...group,
      entries: group.entries.slice(0, shown),
      total,
      hidden: total - shown,
      foldable,
      years: groupYears(group),
      region: sharedRegion(group),
    }
  })
}

/** The region every season of a circuit was played for, or null when they differ. */
function sharedRegion({ circuit, entries }: TournamentGroup) {
  const [first, ...others] = new Set(entries.map((entry) => entry.content.region))
  return circuit && first && !others.length ? first : null
}

/** The years a group spans, such as "2020–2026". */
export function groupYears({ entries }: Pick<TournamentGroup, "entries">) {
  const years = entries.flatMap(({ content }) => content.year ?? [])
  if (!years.length) return ""
  const [first, last] = [Math.min(...years), Math.max(...years)]
  return first === last ? String(first) : `${first}–${last}`
}

const ACTIVE = ["ONGOING", "UPCOMING", "ANNOUNCED"]

/**
 * What is on, then what starts next, soonest first, then what is announced without a date. A tournament whose dates
 * contradict its status is none of these.
 */
export function activeTournaments(entries: readonly Entry[], now = new Date()) {
  const rank = (entry: Entry) => ACTIVE.indexOf(entry.content.status ?? "")
  const start = (entry: Entry) => entry.content.startsOn ?? "9999"
  return entries
    .filter((entry) => rank(entry) >= 0 && !statusConflict(entry.content, now))
    .sort((a, b) => rank(a) - rank(b) || start(a).localeCompare(start(b)) || a.id.localeCompare(b.id))
}

/** Tournaments whose status their own dates contradict, the latest first: each waits for an editor to set it right. */
export function contradictedTournaments(entries: readonly Entry[], now = new Date()) {
  const end = (entry: Entry) => entry.content.endsOn ?? entry.content.startsOn ?? ""
  return entries
    .filter((entry) => statusConflict(entry.content, now))
    .sort((a, b) => end(b).localeCompare(end(a)) || a.id.localeCompare(b.id))
}

/** The champion a finished tournament has on record. Its final table decides, as on the public pages. */
export function championName({ result, placements }: Pick<TournamentContent, "result" | "placements">) {
  return placements?.find((line) => line.place?.trim() === "1")?.teamName || result?.winnerName || null
}
