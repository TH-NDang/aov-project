import type { CompetitionSlot, CompetitionView, PlannedMatch } from "@aov/community-contracts"
import { bracketLanes, matchWinner, type BracketLane } from "./competition-model.ts"
import { competitionMatches, type CompetitionMatch } from "./match-model.ts"

type Side = "a" | "b"
type LaneKey = BracketLane["key"] | "third"

/** Where a round stands in its lane; `bracketRoundName` words it. */
export type BracketRound = {
  lane: LaneKey
  /** Rounds still to come in the lane, 0 for its last one. */
  left: number
  /** The round's place in its lane, from 1. */
  order: number
  matches: number
}

export type BracketNode = {
  entry: CompetitionMatch
  lane: LaneKey
  column: number
  /** Where the middle of the card stands, in cards from the top of the bracket. */
  row: number
  round: BracketRound
}

/** The winner of `from` goes on to `to`. */
export type BracketLink = { from: BracketNode; to: BracketNode; side: Side }

export type BracketLayout = {
  nodes: BracketNode[]
  links: BracketLink[]
  columns: number
  rows: number
  /** The first row of each lane. */
  lanes: { key: LaneKey; row: number }[]
}

const teamOf = ({ match, result }: CompetitionMatch, side: Side) =>
  (side === "a" ? result?.teamAId : result?.teamBId) || match[side].teamId || null

/** Matches in the order they are played: by start, then by the round of the plan, then as the plan lists them. */
function inPlayOrder(entries: CompetitionMatch[]) {
  const start = (entry: CompetitionMatch) => Date.parse(entry.match.scheduledAt || "")
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((x, y) => {
      const [first, second] = [start(x.entry), start(y.entry)]
      const byTime = Number.isNaN(first) || Number.isNaN(second) ? 0 : first - second
      return byTime || x.entry.match.round - y.entry.match.round || x.index - y.index
    })
    .map(({ entry }) => entry)
}

/**
 * The matches of an elimination stage with both sides traced to the match they come from. Imported plans name the
 * teams of every match and no links, so a side without a link of its own takes the team's previous match in the
 * stage: the winner's way when the team won it, the loser's when it lost.
 */
export function tracedMatches(entries: CompetitionMatch[]): PlannedMatch[] {
  const keys = new Set(entries.map((entry) => entry.match.key))
  const last = new Map<string, CompetitionMatch>()
  const traced = new Map<string, PlannedMatch>()
  for (const entry of inPlayOrder(entries)) {
    const side = (key: Side): CompetitionSlot => {
      const slot = entry.match[key]
      if (slot.matchKey && keys.has(slot.matchKey)) return slot
      const team = teamOf(entry, key)
      const before = team ? last.get(team) : undefined
      const winner = before && matchWinner(before)
      if (!team || !before || !winner) return slot
      return {
        type: teamOf(before, winner) === team ? "WINNER" : "LOSER",
        matchKey: before.match.key,
        teamId: team,
      }
    }
    traced.set(entry.match.key, { ...entry.match, a: side("a"), b: side("b") })
    for (const key of ["a", "b"] as const) {
      const team = teamOf(entry, key)
      if (team) last.set(team, entry)
    }
  }
  return entries.map((entry) => traced.get(entry.match.key)!)
}

type Feeder = { match: PlannedMatch; type: CompetitionSlot["type"]; side: Side }

/** The links of a stage, read both ways: what feeds a match, and where its winner goes on. */
function stageLinks(matches: PlannedMatch[]) {
  const byKey = new Map(matches.map((match) => [match.key, match]))
  const feeders = new Map<string, Feeder[]>()
  const onward = new Map<string, PlannedMatch[]>()
  for (const match of matches) {
    const found = (["a", "b"] as const).flatMap((side): Feeder[] => {
      const source = byKey.get(match[side].matchKey ?? "")
      return source ? [{ match: source, type: match[side].type, side }] : []
    })
    feeders.set(match.key, found)
    for (const feeder of found)
      if (feeder.type === "WINNER") onward.set(feeder.match.key, [...(onward.get(feeder.match.key) ?? []), match])
  }
  return {
    feeders: (match: PlannedMatch) => feeders.get(match.key) ?? [],
    onward: (match: PlannedMatch) => onward.get(match.key) ?? [],
  }
}

type Links = ReturnType<typeof stageLinks>

/** The lane of every match; a match two losers play that leads nowhere is the one for third place. */
function laneOfMatches(matches: PlannedMatch[], links: Links) {
  const lanes = new Map<string, LaneKey>()
  for (const lane of bracketLanes(matches))
    for (const round of lane.rounds) for (const match of round.matches) lanes.set(match.key, lane.key)
  for (const match of matches) {
    const sources = links.feeders(match)
    const losers = sources.length === 2 && sources.every((feeder) => feeder.type === "LOSER")
    if (lanes.get(match.key) === "rounds" && losers && !links.onward(match).length) lanes.set(match.key, "third")
  }
  return lanes
}

/** The column of every match: one past the furthest match that feeds it. */
function columnOfMatches(matches: PlannedMatch[], links: Links) {
  const columns = new Map<string, number>()
  const column = (match: PlannedMatch, seen: string[]): number => {
    const known = columns.get(match.key)
    if (known != null) return known
    if (seen.includes(match.key)) return 0
    const sources = links.feeders(match).map((feeder) => column(feeder.match, [...seen, match.key]))
    const value = sources.length ? Math.max(...sources) + 1 : 0
    columns.set(match.key, value)
    return value
  }
  for (const match of matches) column(match, [])
  // A match nobody feeds moves next to the one it leads to, so a late entry does not start in the first round.
  for (const match of matches) {
    const next = links.onward(match).map((item) => columns.get(item.key)!)
    if (!links.feeders(match).length && next.length) columns.set(match.key, Math.max(0, Math.min(...next) - 1))
  }
  // Matches nobody links keep the rounds of the plan.
  if (matches.length > 1 && matches.every((match) => !links.feeders(match).length)) {
    const rounds = [...new Set(matches.map((match) => match.round))].sort((x, y) => x - y)
    for (const match of matches) columns.set(match.key, rounds.indexOf(match.round))
  }
  return columns
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

/**
 * Where every match of an elimination stage stands: its lane, the column of its round and its row, so that a match
 * stands level with the middle of the matches that feed it. A match for third place stands under the final.
 */
export function bracketLayout(entries: CompetitionMatch[]): BracketLayout {
  const matches = tracedMatches(entries)
  const links = stageLinks(matches)
  const lanes = laneOfMatches(matches, links)
  const columns = columnOfMatches(matches, links)
  const laneOf = (match: PlannedMatch) => lanes.get(match.key)!
  const columnOf = (match: PlannedMatch) => columns.get(match.key)!

  const rows = new Map<string, number>()
  const headings: BracketLayout["lanes"] = []
  let next = 0
  const place = (match: PlannedMatch): number => {
    const known = rows.get(match.key)
    if (known != null) return known
    rows.set(match.key, 0)
    const inside = links
      .feeders(match)
      .filter((feeder) => feeder.type === "WINNER" && laneOf(feeder.match) === laneOf(match))
      .map((feeder) => place(feeder.match))
    const row = inside.length ? mean(inside) : next++
    rows.set(match.key, row)
    return row
  }
  for (const lane of ["upper", "rounds", "lower"] as const) {
    const own = matches.filter((match) => laneOf(match) === lane)
    if (!own.length) continue
    headings.push({ key: lane, row: next })
    // The match that ends the lane places its whole tree first.
    const ends = own.filter((match) => !links.onward(match).some((item) => laneOf(item) === lane))
    for (const match of [...ends.sort((x, y) => columnOf(y) - columnOf(x)), ...own]) place(match)
  }
  for (const match of matches.filter((item) => laneOf(item) === "final")) {
    const sources = links.feeders(match).map((feeder) => rows.get(feeder.match.key) ?? 0)
    rows.set(match.key, sources.length ? mean(sources) : 0)
    headings.push({ key: "final", row: rows.get(match.key)! })
  }
  const lastColumn = Math.max(0, ...columns.values())
  for (const match of matches.filter((item) => laneOf(item) === "third")) {
    const above = matches.filter((item) => columnOf(item) === lastColumn && rows.has(item.key))
    const row = Math.max(-1, ...above.map((item) => rows.get(item.key)!)) + 1
    columns.set(match.key, lastColumn)
    rows.set(match.key, row)
    next = Math.max(next, row + 1)
  }

  const entryOf = new Map(entries.map((entry) => [entry.match.key, entry]))
  const roundOf = (match: PlannedMatch): BracketRound => {
    const peers = matches.filter((item) => laneOf(item) === laneOf(match))
    const own = [...new Set(peers.map(columnOf))].sort((x, y) => x - y)
    const at = own.indexOf(columnOf(match))
    return {
      lane: laneOf(match),
      order: at + 1,
      left: own.length - 1 - at,
      matches: peers.filter((item) => columnOf(item) === columnOf(match)).length,
    }
  }
  const nodes = matches.map((match): BracketNode => ({
    entry: entryOf.get(match.key)!,
    lane: laneOf(match),
    column: columnOf(match),
    row: rows.get(match.key)!,
    round: roundOf(match),
  }))
  const nodeOf = new Map(nodes.map((node) => [node.entry.match.key, node]))
  const drawn = matches.flatMap((match) =>
    links
      .feeders(match)
      .flatMap((feeder): BracketLink[] =>
        feeder.type === "WINNER" && columnOf(feeder.match) < columnOf(match)
          ? [{ from: nodeOf.get(feeder.match.key)!, to: nodeOf.get(match.key)!, side: feeder.side }]
          : [],
      ),
  )
  return { nodes, links: drawn, columns: lastColumn + 1, rows: Math.max(1, next), lanes: headings }
}

export type RoundWeight = "final" | "closing" | "semi"

/**
 * How close a round is to the title: the final itself, the match that closes a lane, the semifinals of either kind, or
 * null for the rounds before them.
 */
export function roundWeight({ lane, left, matches }: BracketRound): RoundWeight | null {
  if (lane === "final" || (lane === "rounds" && left === 0 && matches === 1)) return "final"
  if ((lane === "upper" || lane === "lower") && left === 0 && matches === 1) return "closing"
  if (left === 1 && (lane === "lower" ? matches === 1 : lane !== "third" && matches === 2)) return "semi"
  return null
}

/** A round of a bracket in `locale`. */
export function bracketRoundName({ lane, left, order, matches }: BracketRound, locale = "vi-VN"): string {
  const pick = (vi: string, en: string) => (locale.startsWith("en") ? en : vi)
  if (lane === "third") return pick("Tranh hạng ba", "Third place match")
  if (lane === "final") return pick("Chung kết tổng", "Grand final")
  if (lane === "upper") {
    if (left === 0 && matches === 1) return pick("Chung kết nhánh thắng", "Upper bracket final")
    if (left === 1 && matches === 2) return pick("Bán kết nhánh thắng", "Upper bracket semifinal")
    if (left === 2 && matches === 4) return pick("Tứ kết nhánh thắng", "Upper bracket quarterfinal")
    return pick(`Vòng ${order} nhánh thắng`, `Upper bracket round ${order}`)
  }
  if (lane === "lower") {
    if (left === 0 && matches === 1) return pick("Chung kết nhánh thua", "Lower bracket final")
    if (left === 1 && matches === 1) return pick("Bán kết nhánh thua", "Lower bracket semifinal")
    return pick(`Vòng ${order} nhánh thua`, `Lower bracket round ${order}`)
  }
  if (left === 0 && matches === 1) return pick("Chung kết", "Final")
  if (left === 1 && matches === 2) return pick("Bán kết", "Semifinal")
  if (left === 2 && matches === 4) return pick("Tứ kết", "Quarterfinal")
  return pick(`Vòng ${order}`, `Round ${order}`)
}

const layouts = new WeakMap<CompetitionView["content"], Map<string, BracketLayout>>()

/** The bracket of one elimination stage, worked out once for each published version of a competition. */
export function stageBracket(view: CompetitionView, stageCode: string): BracketLayout {
  const known = layouts.get(view.content) ?? new Map<string, BracketLayout>()
  layouts.set(view.content, known)
  const found = known.get(stageCode)
  if (found) return found
  const layout = bracketLayout(competitionMatches([view]).filter((entry) => entry.match.stageCode === stageCode))
  known.set(stageCode, layout)
  return layout
}

const ELIMINATION = ["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION"]

/** The round a match stands in, read from the bracket of its stage; null where the stage is no bracket. */
export function bracketRoundOf(entry: CompetitionMatch): BracketRound | null {
  const { plan } = entry.competition.content
  const stage = plan.stages.find((item) => item.code === entry.match.stageCode)
  if (!stage || !ELIMINATION.includes(stage.format)) return null
  const layout = stageBracket(entry.competition, stage.code)
  // A stage of separate matches has no rounds to name.
  if (!layout.links.length) return null
  return layout.nodes.find((node) => node.entry.match.key === entry.match.key)?.round ?? null
}
