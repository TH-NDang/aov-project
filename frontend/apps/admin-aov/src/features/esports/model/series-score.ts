import type { DocumentView, GameContent, SeriesContent } from "@aov/community-contracts"

/** A team of a match, by its place in the schedule. */
export type MatchTeam = "A" | "B"
export type SeriesScore = { scoreA: number; scoreB: number }
type Game = { content: GameContent }

/** Which team of the match won a game, read from the side that won it. */
export function gameWinner(series: SeriesContent, game: GameContent): MatchTeam | null {
  const teamId = game.winner && game.sides.find((side) => side.side === game.winner)?.teamId
  return teamId === series.teamAId ? "A" : teamId === series.teamBId ? "B" : null
}

/** Games won by each team, and how many games still have no winner. */
export function gameWins(series: SeriesContent, games: readonly Game[]) {
  const wins = { scoreA: 0, scoreB: 0, open: 0 }
  for (const game of games) {
    const winner = gameWinner(series, game.content)
    if (winner === "A") wins.scoreA++
    else if (winner === "B") wins.scoreB++
    else wins.open++
  }
  return wins
}

const decided = (bestOf: number, score: SeriesScore) =>
  bestOf % 2 === 0
    ? score.scoreA + score.scoreB === bestOf
    : Math.max(score.scoreA, score.scoreB) === Math.ceil(bestOf / 2)

/**
 * The score the recorded games give when it is not the score of the match: every game that should exist has a winner
 * and the tally differs, or one team already won more games than its score says. Null while they agree, or while the
 * games are too few to say anything.
 */
export function scoreFromGames(series: SeriesContent, games: readonly Game[]): SeriesScore | null {
  if (!games.length) return null
  const { scoreA, scoreB, open } = gameWins(series, games)
  const tally = { scoreA, scoreB }
  const result = series.result
  if (!result) return open === 0 && decided(series.bestOf, tally) ? tally : null
  if (scoreA === result.scoreA && scoreB === result.scoreB) return null
  const overrun = scoreA > result.scoreA || scoreB > result.scoreB
  const whole = open === 0 && games.length >= result.scoreA + result.scoreB
  return overrun || whole ? tally : null
}

/** Numbers of the games the score says were played but nobody recorded, gaps first. */
export function missingGameNumbers(series: SeriesContent, games: readonly Game[]): number[] {
  const result = series.result
  if (!result) return []
  const expected = Math.min(series.bestOf, result.scoreA + result.scoreB)
  const recorded = new Set(games.map((game) => game.content.number))
  const missing: number[] = []
  for (let number = 1; missing.length < expected - games.length; number++)
    if (!recorded.has(number)) missing.push(number)
  return missing
}

/** The number a new game takes: the first one nobody recorded. */
export function nextGameNumber(games: readonly Game[]) {
  const recorded = new Set(games.map((game) => game.content.number))
  let number = 1
  while (recorded.has(number)) number++
  return number
}

/** Whether the match has every game its score says was played. Without a score nothing tells. */
export const hasEveryGame = (series: SeriesContent, games: readonly Game[]) =>
  !!series.result && games.length >= series.result.scoreA + series.result.scoreB

export type QuickWinners = Record<number, MatchTeam | null>

/**
 * Winners the score settles by itself: every open game when one team has no more wins to take, otherwise the last
 * game of a decided match, which the winner of the match always takes. The rest is for the editor to say.
 */
export function presetWinners(series: SeriesContent, games: readonly Game[], numbers: readonly number[]): QuickWinners {
  const winners: QuickWinners = Object.fromEntries(numbers.map((number) => [number, null]))
  const result = series.result
  if (!result || !numbers.length) return winners
  const won = gameWins(series, games)
  const left = { A: result.scoreA - won.scoreA, B: result.scoreB - won.scoreB }
  if (left.A + left.B === numbers.length && (left.A === 0 || left.B === 0)) {
    for (const number of numbers) winners[number] = left.A === 0 ? "B" : "A"
    return winners
  }
  const last = result.scoreA + result.scoreB
  if (result.scoreA !== result.scoreB && numbers.includes(last))
    winners[last] = result.scoreA > result.scoreB ? "A" : "B"
  return winners
}

/** The game with the team that won it and its length; a value that is not given keeps what is recorded. */
export function withQuickResult(
  series: SeriesContent,
  game: GameContent,
  winner: MatchTeam | null,
  durationSeconds: number | null,
): GameContent {
  const teamId = winner === "A" ? series.teamAId : winner === "B" ? series.teamBId : null
  const side = teamId ? game.sides.find((entry) => entry.teamId === teamId)?.side : undefined
  return {
    ...game,
    winner: side ?? game.winner ?? null,
    durationSeconds: durationSeconds ?? game.durationSeconds ?? null,
  }
}

/** One row of the quick entry: a game to create (`entry` null) or one already recorded, with its winner if known. */
export type QuickRow = { number: number; entry: DocumentView<GameContent> | null; winner: MatchTeam | null }

/** Every game the match should have, in order: the recorded ones and those still missing. */
export function quickRows(series: SeriesContent, games: readonly DocumentView<GameContent>[]): QuickRow[] {
  const missing = missingGameNumbers(series, games).map((number) => ({ number, entry: null, winner: null }))
  const recorded = games.map((entry) => ({
    number: entry.content.number,
    entry,
    winner: gameWinner(series, entry.content),
  }))
  return [...missing, ...recorded].sort((a, b) => a.number - b.number)
}

/** Numbers the quick entry can still fill in: missing games, and recorded ones nobody named a winner for. */
export const openQuickNumbers = (rows: readonly QuickRow[]) =>
  rows.filter((row) => !row.winner).map((row) => row.number)

/** What the quick entry will have recorded once saved, for a comparison with the score. */
export function quickTally(rows: readonly QuickRow[], winners: QuickWinners) {
  const tally = { scoreA: 0, scoreB: 0, open: 0 }
  for (const row of rows) {
    const winner = row.winner ?? winners[row.number] ?? null
    if (winner === "A") tally.scoreA++
    else if (winner === "B") tally.scoreB++
    else tally.open++
  }
  return tally
}
