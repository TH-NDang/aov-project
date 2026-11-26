import type { CompetitionStage, CompetitionStanding, CompetitionView } from "@aov/community-contracts"
import { bracketRoundOf, stageBracket, type BracketRound } from "./bracket-model.ts"
import { isElimination, playedOrder } from "./competition-model.ts"
import { competitionMatches, type CompetitionMatch } from "./match-model.ts"
import { laterStages, standingGroups, tableOver } from "./standings-model.ts"

type Table = CompetitionView["content"]["standings"][number]

/** Where a place of a table leads: a round of a bracket, another table, on in general, or out. */
export type PlaceWay =
  | { kind: "ROUND"; stage: CompetitionStage; round: BracketRound }
  | { kind: "STAGE"; stage: CompetitionStage }
  | { kind: "ON" }
  | { kind: "OUT" }
/** Neighbouring places that lead the same way; places count from 1. */
export type PlaceZone = { from: number; to: number; way: PlaceWay }
export type PlaceZones = {
  /** Zones from the first place down; empty while nothing says where places lead. */
  zones: PlaceZone[]
  /** The way of each team, where the ways of neighbours are mixed and make no zones. */
  ways: Map<string, PlaceWay>
  /** Whether the stage is over, so that its teams have their place, not only its rank. */
  settled: boolean
}

const wayKey = (way: PlaceWay) => {
  if (way.kind === "ROUND") return `${way.stage.code}:${way.round.lane}:${way.round.order}`
  return way.kind === "STAGE" ? way.stage.code : way.kind
}

const teamsOf = ({ match, result }: CompetitionMatch) => [
  result?.teamAId || match.a.teamId || null,
  result?.teamBId || match.b.teamId || null,
]

function wayInto(entry: CompetitionMatch, stage: CompetitionStage): PlaceWay {
  const round = isElimination(stage) ? bracketRoundOf(entry) : null
  return round ? { kind: "ROUND", stage, round } : { kind: "STAGE", stage }
}

/** The first match of a list, as the plan orders a bracket: by its column, then by the hour. */
function firstOf(entries: CompetitionMatch[], stage: CompetitionStage, view: CompetitionView) {
  const columns = isElimination(stage)
    ? new Map(stageBracket(view, stage.code).nodes.map((node) => [node.entry.match.key, node.column]))
    : null
  const start = (entry: CompetitionMatch) => Date.parse(entry.match.scheduledAt || "") || Infinity
  return [...entries].sort(
    (x, y) =>
      (columns?.get(x.match.key) ?? 0) - (columns?.get(y.match.key) ?? 0) ||
      start(x) - start(y) ||
      x.match.round - y.match.round,
  )[0]
}

/** The first match each team plays in a later stage, as the way its place led. */
function knownWays(view: CompetitionView, later: CompetitionStage[], rows: CompetitionStanding[]) {
  const entries = competitionMatches([view])
  const ways = new Map<string, PlaceWay>()
  for (const next of later) {
    const own = entries.filter((entry) => entry.match.stageCode === next.code)
    for (const { teamId } of rows) {
      if (ways.has(teamId)) continue
      const first = firstOf(
        own.filter((entry) => teamsOf(entry).includes(teamId)),
        next,
        view,
      )
      if (first) ways.set(teamId, wayInto(first, next))
    }
  }
  return ways
}

/**
 * What the brackets that follow a table still wait for: the place each seed stands for, with its way while no team is
 * on it yet, and whether a side is open that no seed speaks for.
 */
function waitingSides(view: CompetitionView, later: CompetitionStage[]) {
  const entries = competitionMatches([view])
  const seeds = new Map<number, PlaceWay | null>()
  let undecided = false
  for (const next of later) {
    // Behind another table the seeds are places of that table.
    if (!isElimination(next)) {
      undecided ||= entries.some((entry) => entry.match.stageCode === next.code && teamsOf(entry).includes(null))
      break
    }
    for (const entry of entries.filter((item) => item.match.stageCode === next.code))
      for (const [index, slot] of [entry.match.a, entry.match.b].entries()) {
        const open = teamsOf(entry)[index] == null
        if (slot.type === "SEED" && slot.seed) {
          if (!seeds.has(slot.seed)) seeds.set(slot.seed, open ? wayInto(entry, next) : null)
        } else if (open && (slot.type === "TBD" || slot.type === "TEAM")) undecided = true
      }
  }
  return { seeds, undecided }
}

/**
 * Where the places of one group lead, read from what the plan holds: the first match each team plays in a later stage,
 * the seeds of a later bracket while its teams are open, or the number of teams the stage sends on. Nothing is guessed
 * where the plan says nothing.
 */
export function placeZones(
  view: CompetitionView,
  stage: CompetitionStage,
  rows: CompetitionStanding[],
  settled: boolean,
  onlyGroup: boolean,
): PlaceZones {
  const later = laterStages(view, stage.code)
  const ways = knownWays(view, later, rows)
  const { seeds, undecided } = waitingSides(view, later)
  const waiting = [...seeds.values()].some((way) => way)
  const wayAt = (row: CompetitionStanding, place: number): PlaceWay | null => {
    const known = ways.get(row.teamId)
    if (known) return known
    // A seed is a place of the table only while the stage is one table.
    const seed = onlyGroup ? seeds.get(place) : undefined
    if (seed) return seed
    if (ways.size || (onlyGroup && seeds.size)) {
      const taken = !undecided && (!waiting || (onlyGroup && seed === undefined))
      return taken ? { kind: "OUT" } : null
    }
    const advance = onlyGroup ? stage.advance : 0
    return advance > 0 ? { kind: place <= advance ? "ON" : "OUT" } : null
  }
  const zones: PlaceZone[] = []
  let unknown = false
  rows.forEach((row, index) => {
    const way = wayAt(row, index + 1)
    const last = zones.at(-1)
    if (!way) unknown = true
    else if (last && last.to === index && wayKey(last.way) === wayKey(way)) last.to = index + 1
    else zones.push({ from: index + 1, to: index + 1, way })
  })
  const mixed = unknown || new Set(zones.map((zone) => wayKey(zone.way))).size < zones.length
  // Everybody goes the same way: a heading over all of them says nothing a reader needs.
  if (mixed || zones.length < 2) return { zones: [], ways: mixed ? ways : new Map(), settled }
  return { zones, ways: new Map(), settled }
}

/**
 * Whether a place in a zone is out of the competition. While the table can still change, a team level with one above the
 * zone is no more out than that one.
 */
export const isOut = (zone: PlaceZone | null, { rank }: Pick<CompetitionStanding, "rank">, final: boolean) =>
  zone?.way.kind === "OUT" && (final || rank >= zone.from)

/** The place a team took in the table that led into a stage, with the letter of its group where groups have letters. */
export type TablePlace = { place: number; group: string | null }

/** The final tables that led into a stage, the nearest first. */
function tablesBefore(view: CompetitionView, stageCode: string): Table[] {
  const before = view.content.standings.filter(
    (table) => tableOver(view, table) && laterStages(view, table.stageCode).some(({ code }) => code === stageCode),
  )
  // The table with the fewest stages after it stands nearest.
  return before.sort((x, y) => laterStages(view, x.stageCode).length - laterStages(view, y.stageCode).length)
}

/** The place each team of a stage took in the final table before it, the nearest one where there are several. */
export function placesBefore(view: CompetitionView, stageCode: string): Map<string, TablePlace> {
  const entries = competitionMatches([view]).filter((entry) => entry.match.stageCode === stageCode)
  const teams = new Set(entries.flatMap(teamsOf))
  const places = new Map<string, TablePlace>()
  for (const table of tablesBefore(view, stageCode)) {
    for (const { name, rows } of standingGroups(view, table))
      for (const { teamId, rank, played } of rows)
        if (played > 0 && teams.has(teamId) && !places.has(teamId))
          places.set(teamId, { place: rank, group: name && /^[A-Z]$/.test(name) ? name : null })
  }
  return places
}

/** The places of two teams in one table, once both have played in it; the groups of a stage are tables of their own. */
function placesIn(view: CompetitionView, table: Table, a: string, b: string) {
  for (const { rows } of standingGroups(view, table)) {
    const [first, second] = [a, b].map((team) => rows.find(({ teamId, played }) => teamId === team && played > 0))
    if (first && second) return { a: first.rank, b: second.rank }
  }
  return null
}

/**
 * The places by which two teams of a match compare. They are places of one table: that of the stage itself, else the one
 * the bracket of the stage takes its places from, else the last table played that holds both.
 */
export function comparedPlaces(view: CompetitionView, stageCode: string, a: string, b: string) {
  const { plan, standings } = view.content
  const own = standings.find((table) => table.stageCode === stageCode)
  const here = own && placesIn(view, own, a, b)
  if (here) return here
  const plays = ({ teamId, played }: CompetitionStanding) => played > 0 && (teamId === a || teamId === b)
  const brought = tablesBefore(view, stageCode).find(({ rows }) => rows.some(plays))
  if (brought) return placesIn(view, brought, a, b)
  const order = playedOrder(plan.stages, plan.matches).map(({ code }) => code)
  const latest = [...standings].sort((x, y) => order.indexOf(y.stageCode) - order.indexOf(x.stageCode))
  return latest.map((table) => placesIn(view, table, a, b)).find((places) => places) ?? null
}
