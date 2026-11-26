import type { CompetitionView } from "@aov/community-contracts"
import {
  bracketRoundName as roundName,
  readBracket,
  type BracketLane,
  type BracketMatch,
  type BracketRound,
} from "@aov/community-contracts/bracket-results"
import { localeText } from "@aov/ui/lib/locale-text"
import { isElimination, matchWinner } from "./competition-model.ts"
import { competitionMatches, type CompetitionMatch } from "./match-model.ts"

export type { BracketRound }

type Side = "a" | "b"

export type BracketNode = {
  entry: CompetitionMatch
  lane: BracketLane
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
  lanes: { key: BracketLane; row: number }[]
}

const teamOf = ({ match, result }: CompetitionMatch, side: Side) =>
  (side === "a" ? result?.teamAId : result?.teamBId) || match[side].teamId || null

/** A match as its bracket is read from it; it is decided once a side has the wins its best of asks for. */
function bracketResult(entry: CompetitionMatch) {
  const teams = { a: teamOf(entry, "a"), b: teamOf(entry, "b") }
  const won = matchWinner(entry)
  return {
    entry,
    match: entry.match,
    teamA: teams.a,
    teamB: teams.b,
    winner: won && teams[won],
    loser: won && teams[won === "a" ? "b" : "a"],
  }
}

type Item = BracketMatch<ReturnType<typeof bracketResult>>

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

/**
 * Where every match of an elimination stage stands: its lane, the column of its round and its row, so that a match
 * stands level with the middle of the matches that feed it. A match for a place stands under the final.
 */
export function bracketLayout(entries: CompetitionMatch[]): BracketLayout {
  const { matches } = readBracket(entries.map(bracketResult))
  const byKey = new Map(matches.map((item) => [item.match.key, item]))
  const feeders = (item: Item) =>
    (["a", "b"] as const).flatMap((side) => {
      const source = item[side]
      return source ? [{ item: byKey.get(source.key)!, type: source.type, side }] : []
    })

  const columns = new Map(matches.map((item) => [item, item.column]))
  // A lower lane that flows into one match counts its rounds back from that match, so a match fed from a short way
  // may stand in an earlier column than its round. Each match moves to the column of its round, counted back from the
  // match that ends the lane, so that a column holds one round and its heading names every match under it.
  const lower = matches.filter((item) => item.lane === "lower")
  const laneEnds = lower.filter((item) => byKey.get(item.winnerTo ?? "")?.lane !== "lower")
  if (laneEnds.length === 1) {
    const [end] = laneEnds as [Item]
    for (const item of lower) columns.set(item, end.column - (end.round.order - item.round.order))
  }
  const rows = new Map<Item, number>()
  const headings: BracketLayout["lanes"] = []
  let next = 0
  const place = (item: Item): number => {
    const known = rows.get(item)
    if (known != null) return known
    rows.set(item, 0)
    const inside = feeders(item)
      .filter((feeder) => feeder.type === "WINNER" && feeder.item.lane === item.lane)
      .map((feeder) => place(feeder.item))
    const row = inside.length ? mean(inside) : next++
    rows.set(item, row)
    return row
  }
  for (const lane of ["upper", "rounds", "lower"] as const) {
    const own = matches.filter((item) => item.lane === lane)
    if (!own.length) continue
    headings.push({ key: lane, row: next })
    // The match that ends the lane places its whole tree first.
    const ends = own.filter((item) => byKey.get(item.winnerTo ?? "")?.lane !== lane)
    for (const item of [...ends.sort((x, y) => y.column - x.column), ...own]) place(item)
  }
  for (const item of matches.filter(({ lane }) => lane === "final")) {
    const sources = feeders(item).map((feeder) => rows.get(feeder.item) ?? 0)
    rows.set(item, sources.length ? mean(sources) : 0)
    headings.push({ key: "final", row: rows.get(item)! })
  }
  const lastColumn = Math.max(0, ...columns.values())
  for (const item of matches.filter(({ lane }) => lane === "place")) {
    const above = matches.filter((other) => columns.get(other) === lastColumn && rows.has(other))
    const row = Math.max(-1, ...above.map((other) => rows.get(other)!)) + 1
    columns.set(item, lastColumn)
    rows.set(item, row)
    next = Math.max(next, row + 1)
  }

  const nodeOf = new Map(
    matches.map((item): [Item, BracketNode] => {
      const { entry, lane, round } = item
      return [item, { entry, lane, column: columns.get(item)!, row: rows.get(item)!, round }]
    }),
  )
  const links = matches.flatMap((item) =>
    feeders(item).flatMap((feeder): BracketLink[] =>
      feeder.type === "WINNER" && feeder.item.column < item.column
        ? [{ from: nodeOf.get(feeder.item)!, to: nodeOf.get(item)!, side: feeder.side }]
        : [],
    ),
  )
  return { nodes: [...nodeOf.values()], links, columns: lastColumn + 1, rows: Math.max(1, next), lanes: headings }
}

export type RoundWeight = "final" | "closing" | "semi"

/**
 * How close a round is to the title: the final itself, the match that closes a lane, the semifinals of either kind, or
 * null for the rounds before them.
 */
export function roundWeight({ lane, left, matches }: BracketRound): RoundWeight | null {
  if (lane === "final" || (lane === "rounds" && left === 0 && matches === 1)) return "final"
  if ((lane === "upper" || lane === "lower") && left === 0 && matches === 1) return "closing"
  if (left === 1 && (lane === "lower" ? matches === 1 : lane !== "place" && matches === 2)) return "semi"
  return null
}

/** A round of a bracket in `locale`. */
export const bracketRoundName = (round: BracketRound, locale = "vi-VN") => roundName(round, localeText(locale))

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

/** The round a match stands in, read from the bracket of its stage; null where the stage is no bracket. */
export function bracketRoundOf(entry: CompetitionMatch): BracketRound | null {
  const { plan } = entry.competition.content
  const stage = plan.stages.find((item) => item.code === entry.match.stageCode)
  if (!stage || !isElimination(stage)) return null
  const layout = stageBracket(entry.competition, stage.code)
  // A stage of separate matches has no rounds to name.
  if (!layout.links.length) return null
  return layout.nodes.find((node) => node.entry.match.key === entry.match.key)?.round ?? null
}
