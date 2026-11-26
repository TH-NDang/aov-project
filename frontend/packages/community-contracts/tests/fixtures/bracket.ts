/** Matches of brackets for tests, and what a bracket read from them tells. */
import { bracketRoundName, matchResult, type Bracket, type BracketMatch } from "../../src/bracket-results.ts"
import type { CompetitionSlot, PlannedMatch } from "../../src/competition.ts"
import type { TitleText } from "../../src/match-titles.ts"

export const vietnamese: TitleText = (vi) => vi
export const english: TitleText = (_vi, en) => en

export const winnerOf = (matchKey: string): CompetitionSlot => ({ type: "WINNER", matchKey })
export const loserOf = (matchKey: string): CompetitionSlot => ({ type: "LOSER", matchKey })
export const seed = (number: number): CompetitionSlot => ({ type: "SEED", seed: number })

/** A match that names its teams and no links, as imports write it: "a 3-1 b", or "a - b" before it is played. */
export function game(key: string, round: number, line: string, more: Partial<PlannedMatch> = {}) {
  const [, teamAId, scoreA, scoreB, teamBId] = /^(\w+) (\d*)-(\d*) (\w+)$/.exec(line)!
  const match: PlannedMatch = {
    key,
    stageCode: "PLAYOFF",
    round,
    bestOf: 5,
    a: { type: "TEAM", teamId: teamAId },
    b: { type: "TEAM", teamId: teamBId },
    ...more,
  }
  const score = (text: string | undefined) => (text ? Number(text) : null)
  return matchResult(match, { key, teamAId, teamBId, scoreA: score(scoreA), scoreB: score(scoreB), consistent: true })
}

/** A match that waits for the teams its links and seeds send it. */
export const linked = (key: string, round: number, a: CompetitionSlot, b: CompetitionSlot) =>
  matchResult({ key, stageCode: "PLAYOFF", round, bestOf: 5, a, b }, undefined)

export const knockout = [
  game("QF1", 1, "a 3-0 h"),
  game("QF2", 1, "d 3-1 e"),
  game("QF3", 1, "b 3-1 g"),
  game("QF4", 1, "c 3-2 f"),
  game("SF1", 2, "a 3-1 d"),
  game("SF2", 2, "b 3-2 c"),
  game("F", 3, "a 4-2 b"),
]

/** Six teams, of which the last two seeds start in the lower lane. */
export const doubleElimination = [
  game("US1", 1, "a 4-2 c"),
  game("US2", 1, "b 4-1 d"),
  game("LQ1", 2, "e 1-4 c"),
  game("LQ2", 2, "f 4-3 d"),
  game("UF", 2, "a 3-4 b"),
  game("LS", 3, "c 4-3 f"),
  game("LF", 4, "a 2-4 c"),
  game("GF", 5, "b 4-2 c"),
]

/** Eight teams in two lanes, as the playoffs of the APL 2026. */
export const eightInTwoLanes = [
  game("U1", 1, "a 3-2 b"),
  game("U2", 1, "c 2-3 d"),
  game("U3", 1, "e 3-2 f"),
  game("U4", 1, "g 3-0 h"),
  game("L1", 2, "b 3-2 c"),
  game("L2", 2, "f 3-0 h"),
  game("US1", 2, "a 4-3 d"),
  game("US2", 2, "e 2-4 g"),
  game("L3", 3, "e 2-4 b"),
  game("L4", 3, "d 1-4 f"),
  game("UF", 3, "a 1-4 g"),
  game("LS", 4, "b 1-4 f"),
  game("LF", 5, "a 4-3 f"),
  game("GF", 6, "g 4-2 a"),
]

const saturday = { scheduledAt: "2026-06-06T00:00:00Z" }
const sunday = { scheduledAt: "2026-06-07T00:00:00Z" }

/** A qualifier that sends on four of eight teams, two of whose matches nobody scored: the wildcard of the TEPL 2026. */
export const unscoredQualifier = [
  game("U1", 1, "a 1-2 b", saturday),
  game("U2", 1, "c 0-2 d", saturday),
  game("U3", 1, "e - f", saturday),
  game("U4", 1, "g 0-2 h", saturday),
  game("U5", 2, "b 1-3 d", saturday),
  game("U6", 2, "f 3-1 h", saturday),
  game("L1", 1, "a 1-2 c", sunday),
  game("L2", 1, "e - g", sunday),
  game("L3", 2, "b 3-0 c", sunday),
  game("L4", 2, "h 3-0 g", sunday),
]

/** A qualifier for two: its first winner goes on at once, and the loser has another chance. */
export const pagePlayoffForTwo = [game("Q", 1, "a 3-1 b"), game("E", 1, "c 3-2 d"), game("SF", 2, "b 3-1 c")]

/** A page playoff the plan links, with one more match in it for the winner of the first. */
export const pagePlayoffWithExtra = [
  game("Q", 1, "a 3-1 b"),
  game("E", 1, "c 3-2 d"),
  linked("SF", 2, loserOf("Q"), winnerOf("E")),
  game("X", 2, "a 3-0 d"),
  linked("F", 3, winnerOf("Q"), winnerOf("SF")),
]

export const find = (bracket: Bracket, key: string) => bracket.matches.find(({ match }) => match.key === key)!
export const keys = (matches: BracketMatch[]) => matches.map(({ match }) => match.key)

/** What each match of a bracket has, by its key. */
const each = <Value>(bracket: Bracket, value: (item: BracketMatch) => Value) =>
  Object.fromEntries(bracket.matches.map((item) => [item.match.key, value(item)]))

export const lanes = (bracket: Bracket) => each(bracket, ({ lane }) => lane)
export const columns = (bracket: Bracket) => each(bracket, ({ column }) => column)
export const names = (bracket: Bracket, text = vietnamese) =>
  each(bracket, ({ round }) => bracketRoundName(round, text))
