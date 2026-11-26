import type { CompetitionSlot, PlannedMatch, ResolvedMatch } from "./competition"
import type { TitleText } from "./match-titles"

/** A planned match with the teams it has and, once it is decided, who won it. */
export type MatchResult = {
  match: PlannedMatch
  teamA: string | null
  teamB: string | null
  winner: string | null
  loser: string | null
  /** The games of the winner, then those of the loser. */
  score: readonly [number, number] | null
}

/** A match as the backend resolves it: a draw, or a score that contradicts the plan, decides nothing. */
export function matchResult(match: PlannedMatch, row: ResolvedMatch | undefined): MatchResult {
  const teamA = row?.teamAId || match.a.teamId || null
  const teamB = row?.teamBId || match.b.teamId || null
  const { scoreA, scoreB } = row ?? {}
  const scored = scoreA != null && scoreB != null && scoreA !== scoreB
  if (!scored || !row?.consistent || !teamA || !teamB)
    return { match, teamA, teamB, winner: null, loser: null, score: null }
  return scoreA > scoreB
    ? { match, teamA, teamB, winner: teamA, loser: teamB, score: [scoreA, scoreB] }
    : { match, teamA, teamB, winner: teamB, loser: teamA, score: [scoreB, scoreA] }
}

type Planned = Pick<MatchResult, "match">

export type MatchOrder = (x: Planned, y: Planned) => number

const startOf = ({ match }: Planned) => (match.scheduledAt ? Date.parse(match.scheduledAt) : NaN)

/** As the plan lists them. */
export const byPlan: MatchOrder = () => 0

/** By the round of the plan, whatever the hours say. */
export const byRound: MatchOrder = (x, y) => x.match.round - y.match.round

/** By the hour; a match without one, or two at the same hour, by the round of the plan. */
export const byHour: MatchOrder = (x, y) => {
  const [first, second] = [startOf(x), startOf(y)]
  const apart = Number.isNaN(first) || Number.isNaN(second) ? 0 : first - second
  return apart || byRound(x, y)
}

/** What a bracket is read from. Each app says itself when a match is decided, and may hand on more with it. */
export type BracketResult = Omit<MatchResult, "score">

export type BracketReading = {
  /** The order the matches of each team are read in. */
  order?: MatchOrder
  /**
   * Whether no match follows these, so that a loser's match that leads nowhere ends a lower lane, or is for a place when
   * two losers play it. Otherwise it may lead on later, or be a final that a beaten team was let into: a lower lane shows
   * once it leads on, and holds every match of a loser.
   */
  whole?: boolean
}

/** The match one side of a match comes from, and whether it won there. */
export type BracketSource = { key: string; type: "WINNER" | "LOSER" }

/** `place`: two losers play for a place, such as the third, and nobody goes on from there. */
export type BracketLane = "rounds" | "upper" | "lower" | "final" | "place"

/** Where a round stands in its lane; `bracketRoundName` words it. */
export type BracketRound = {
  lane: BracketLane
  /** Rounds still to come in the lane, 0 for its last one; of the matches for a place, only the one for the third has 0. */
  left: number
  /** The round's place in its lane, from 1. */
  order: number
  matches: number
}

export type BracketMatch<Result extends BracketResult = MatchResult> = Result & {
  a: BracketSource | null
  b: BracketSource | null
  /** The keys of the matches its winner and its loser go on to. */
  winnerTo: string | null
  loserTo: string | null
  lane: BracketLane
  /** One past the furthest match that feeds it, so the first round has 0. */
  column: number
  round: BracketRound
  /** How many matches the winner still has to win; null for a match for a place. */
  toEnd: number | null
}

export type Bracket<Result extends BracketResult = MatchResult> = {
  matches: BracketMatch<Result>[]
  /** The matches nobody goes on from: one final, or one for each team a qualifier sends on. */
  ends: BracketMatch<Result>[]
  places: BracketMatch<Result>[]
}

type Sides = readonly [a: BracketSource | null, b: BracketSource | null]

/**
 * Where both sides of every match come from. Imported plans name the teams of every match and no links, so a side
 * without a link of its own takes the team's match before in the stage: the winner's way when the team won it, the
 * loser's when it lost.
 */
function tracedSides(results: readonly BracketResult[], order: MatchOrder) {
  const keys = new Set(results.map(({ match }) => match.key))
  const last = new Map<string, BracketResult>()
  const sides = new Map<string, Sides>()
  const source = (slot: CompetitionSlot, team: string | null): BracketSource | null => {
    if ((slot.type === "WINNER" || slot.type === "LOSER") && slot.matchKey && keys.has(slot.matchKey))
      return { key: slot.matchKey, type: slot.type }
    const before = team ? last.get(team) : undefined
    if (!before?.winner && !before?.loser) return null
    return { key: before.match.key, type: before.winner === team ? "WINNER" : "LOSER" }
  }
  const listed = results.map((result, index) => ({ result, index }))
  for (const { result } of listed.sort((x, y) => order(x.result, y.result) || x.index - y.index)) {
    const { match, teamA, teamB } = result
    sides.set(match.key, [source(match.a, teamA), source(match.b, teamB)])
    for (const team of [teamA, teamB]) if (team) last.set(team, result)
  }
  return sides
}

/** The links of a stage read both ways: what feeds a match, and where its winner and its loser go on. */
function linksOf(results: readonly BracketResult[], order: MatchOrder) {
  const keys = results.map(({ match }) => match.key)
  const sides = tracedSides(results, order)
  const sources = (key: string) => sides.get(key)!.filter((source) => source != null)
  const winnerTo = new Map<string, string>()
  const loserTo = new Map<string, string>()
  for (const key of keys)
    for (const source of sources(key)) (source.type === "WINNER" ? winnerTo : loserTo).set(source.key, key)
  return { keys, sides, sources, winnerTo, loserTo }
}

type Links = ReturnType<typeof linksOf>

/**
 * The lane of every match. A stage where the loser of one of its matches plays on is a double elimination: the matches
 * fed by a loser, those that follow them and those whose winner goes on there form the lower lane, since the lower
 * seeds of a playoff start in it, and the match between the winners of both lanes is the final. Any other stage has one
 * lane.
 */
function lanesOf({ keys, sources, winnerTo }: Links, whole: boolean) {
  const losers = (key: string) => sources(key).filter(({ type }) => type === "LOSER").length
  // Both sides of a rematch come from one match, so its loser did not drop into another lane.
  const isRematch = (key: string) => {
    const [one, other] = sources(key)
    return !!one && one.key === other?.key
  }
  const places = new Set(keys.filter((key) => losers(key) === 2 && !winnerTo.has(key)))
  const dropped = keys.filter((key) => losers(key) && !isRematch(key))
  const lanes = new Map<string, BracketLane>(keys.map((key) => [key, places.has(key) ? "place" : "rounds"]))
  if (!dropped.some((key) => winnerTo.has(key) || (whole && !places.has(key)))) return lanes

  const lower = new Set(dropped.filter((key) => !whole || !places.has(key)))
  for (let changed = true; changed;) {
    changed = false
    for (const key of keys) {
      if (lower.has(key) || isRematch(key)) continue
      const from = sources(key)
      const follows = from.length > 0 && from.every((source) => source.type === "WINNER" && lower.has(source.key))
      if (!follows && !lower.has(winnerTo.get(key) ?? "")) continue
      lower.add(key)
      changed = true
    }
  }
  for (const key of keys) {
    const meeting = isRematch(key) || sources(key).some((source) => lower.has(source.key))
    if (lower.has(key)) lanes.set(key, "lower")
    else if (!places.has(key)) lanes.set(key, meeting ? "final" : "upper")
  }
  return lanes
}

/** The column of every match: one past the furthest match that feeds it. */
function columnsOf(results: readonly BracketResult[], { keys, sources }: Links) {
  const columns = new Map<string, number>()
  const column = (key: string, seen: string[]): number => {
    const known = columns.get(key)
    if (known != null) return known
    if (seen.includes(key)) return 0
    const before = sources(key).map((source) => column(source.key, [...seen, key]))
    const value = before.length ? Math.max(...before) + 1 : 0
    columns.set(key, value)
    return value
  }
  for (const key of keys) column(key, [])
  // A match nobody feeds moves next to the one it leads to, so a late entry does not start in the first round.
  for (const key of keys) {
    const next = keys.filter((other) => sources(other).some(({ type, key: from }) => type === "WINNER" && from === key))
    if (next.length && !sources(key).length)
      columns.set(key, Math.max(0, Math.min(...next.map((other) => columns.get(other)!)) - 1))
  }
  // Matches nobody links keep the rounds of the plan.
  if (keys.length > 1 && keys.every((key) => !sources(key).length)) {
    const rounds = [...new Set(results.map(({ match }) => match.round))].sort((x, y) => x - y)
    for (const { match } of results) columns.set(match.key, rounds.indexOf(match.round))
  }
  return columns
}

/** How many matches the winner of every match still has to win, counted back from those nobody goes on from. */
function distancesOf({ keys, sources, winnerTo }: Links, lanes: ReadonlyMap<string, BracketLane>) {
  const toEnd = new Map<string, number>()
  const walkBack = (key: string, distance: number) => {
    if (toEnd.has(key)) return
    toEnd.set(key, distance)
    for (const source of sources(key)) if (source.type === "WINNER") walkBack(source.key, distance + 1)
  }
  for (const key of keys) if (lanes.get(key) !== "place" && !winnerTo.has(key)) walkBack(key, 0)
  return toEnd
}

/**
 * Reads the bracket of an elimination stage from its results. Stream draws its brackets from it and Admin suggests final
 * places from it, so that a match stands in one lane and one round in both.
 */
export function readBracket<Result extends BracketResult>(
  results: Result[],
  { order = byHour, whole = false }: BracketReading = {},
): Bracket<Result> {
  const links = linksOf(results, order)
  const lanes = lanesOf(links, whole)
  const columns = columnsOf(results, links)
  const toEnd = distancesOf(links, lanes)

  const decidedEnds = results.flatMap(({ match: { key }, winner, loser }) =>
    toEnd.get(key) === 0 && (winner || loser) ? [key] : [],
  )
  /** Whether two beaten semifinalists meet; their final may be missing, or stand in another stage. */
  const forThird = (key: string) => {
    const from = links.sources(key).map((source) => source.key)
    const wins = from.map((source) => toEnd.get(source) ?? 0)
    return wins.includes(1) || (Math.max(...wins) === 0 && decidedEnds.every((end) => from.includes(end)))
  }
  // A lower lane takes losers of the upper one in at several rounds, so a match fed from a short way can stand in an
  // early column. Where the lane flows into one match, its rounds are counted back from that match instead, as the
  // places of the teams out in them are; a lane with several ends, as an open match can leave it, keeps its columns.
  const lower = links.keys.filter((key) => lanes.get(key) === "lower")
  const laneEnds = lower.filter((key) => lanes.get(links.winnerTo.get(key) ?? "") !== "lower")
  const byEnd = laneEnds.length === 1 && lower.every((key) => toEnd.has(key))
  const stepOf = (key: string) => (lanes.get(key) === "lower" && byEnd ? -toEnd.get(key)! : columns.get(key)!)
  const roundOf = (key: string): BracketRound => {
    const lane = lanes.get(key)!
    const peers = links.keys.filter((other) => lanes.get(other) === lane).map(stepOf)
    const own = [...new Set(peers)].sort((x, y) => x - y)
    const at = own.indexOf(stepOf(key))
    return {
      lane,
      left: lane !== "place" ? own.length - 1 - at : forThird(key) ? 0 : 1,
      order: at + 1,
      matches: peers.filter((step) => step === own[at]).length,
    }
  }

  const matches = results.map((result): BracketMatch<Result> => {
    const { key } = result.match
    const [a, b] = links.sides.get(key)!
    return {
      ...result,
      a,
      b,
      winnerTo: links.winnerTo.get(key) ?? null,
      loserTo: links.loserTo.get(key) ?? null,
      lane: lanes.get(key)!,
      column: columns.get(key)!,
      round: roundOf(key),
      toEnd: toEnd.get(key) ?? null,
    }
  })
  return {
    matches,
    ends: matches.filter((item) => item.toEnd === 0),
    places: matches.filter((item) => item.lane === "place"),
  }
}

/** A round of a bracket in the language `text` picks. */
export function bracketRoundName({ lane, left, order, matches }: BracketRound, text: TitleText): string {
  if (lane === "place")
    return left === 0 ? text("Tranh hạng ba", "Third place match") : text("Trận phân hạng", "Placement match")
  if (lane === "final") return text("Chung kết tổng", "Grand final")
  if (lane === "upper") {
    if (left === 0 && matches === 1) return text("Chung kết nhánh thắng", "Upper bracket final")
    if (left === 1 && matches === 2) return text("Bán kết nhánh thắng", "Upper bracket semifinal")
    if (left === 2 && matches === 4) return text("Tứ kết nhánh thắng", "Upper bracket quarterfinal")
    return text(`Vòng ${order} nhánh thắng`, `Upper bracket round ${order}`)
  }
  if (lane === "lower") {
    if (left === 0 && matches === 1) return text("Chung kết nhánh thua", "Lower bracket final")
    if (left === 1 && matches === 1) return text("Bán kết nhánh thua", "Lower bracket semifinal")
    return text(`Vòng ${order} nhánh thua`, `Lower bracket round ${order}`)
  }
  if (left === 0 && matches === 1) return text("Chung kết", "Final")
  if (left === 1 && matches === 2) return text("Bán kết", "Semifinal")
  if (left === 2 && matches === 4) return text("Tứ kết", "Quarterfinal")
  return text(`Vòng ${order}`, `Round ${order}`)
}
