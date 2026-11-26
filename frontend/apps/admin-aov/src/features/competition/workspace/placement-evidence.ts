import type { Bracket, BracketMatch, MatchOrder, MatchResult } from "@aov/community-contracts/bracket-results"

export const isLinked = ({ match }: MatchResult) =>
  [match.a, match.b].some((slot) => slot.type === "WINNER" || slot.type === "LOSER")

/**
 * The results with a winner for each match of a finished stage nobody entered a score for, where the matches around it
 * leave no doubt who won: a team that lost before and plays on, one that next meets a team which has only won while the
 * other next meets one that lost, or the only one to play on, in a round whose winners do. A qualifier may let the
 * winners of a round leave, and their rivals drop into the lower bracket.
 */
export function withWalkovers(results: MatchResult[], order: MatchOrder, qualifier: boolean) {
  const listed = results
    .map((result, index) => ({ result, index }))
    .sort((x, y) => order(x.result, y.result) || x.index - y.index)
    .map(({ result }) => result)
  const plays = ({ teamA, teamB }: MatchResult, id: string) => teamA === id || teamB === id
  const nextMatch = (id: string, at: number) => listed.slice(at + 1).find((next) => plays(next, id))
  const lost = (id: string, before: number) => listed.slice(0, before).some(({ loser }) => loser === id)
  /** Whether the team a team meets next has lost before, or has only won. */
  const nextRival = (id: string, at: number) => {
    const next = nextMatch(id, at)
    const rival = next && (next.teamA === id ? next.teamB : next.teamA)
    if (!rival) return null
    const before = listed.slice(0, listed.indexOf(next)).filter((own) => plays(own, rival))
    if (before.some(({ loser }) => loser === rival)) return "LOST"
    return before.length && before.every(({ winner }) => winner === rival) ? "WON" : null
  }
  const winnersGoOn = ({ match }: MatchResult) => {
    const round = listed.flatMap(({ match: { round }, winner }, at) =>
      winner && round === match.round ? [nextMatch(winner, at)] : [],
    )
    return !qualifier || (round.length > 0 && round.every(Boolean))
  }
  const walkovers = new Map<string, MatchResult>()
  listed.forEach((result, at) => {
    const { match, teamA, teamB } = result
    if (result.winner || !teamA || !teamB) return
    const hasWon = (id: string, other: string) => {
      if (!nextMatch(id, at)) return false
      if (lost(id, at)) return true
      if (!nextMatch(other, at)) return winnersGoOn(result)
      return nextRival(id, at) === "WON" && nextRival(other, at) === "LOST"
    }
    const [winner, loser] = hasWon(teamA, teamB) ? [teamA, teamB] : [teamB, teamA]
    if (hasWon(winner, loser) && !hasWon(loser, winner)) walkovers.set(match.key, { ...result, winner, loser })
  })
  return { results: results.map((result) => walkovers.get(result.match.key) ?? result), walkovers }
}

/**
 * Whether the rounds of a bracket agree with those of the plan: matches as far from the end of their lane stand in one
 * round, their losers go one way, and the rounds of a lane follow each other, but for the upper one, which waits for the
 * lower. A plan that puts all its matches in one round says nothing about them.
 */
function hasEvenRounds({ matches }: Bracket) {
  const numbered = new Set(matches.map(({ match }) => match.round)).size > 1
  return (["rounds", "upper", "lower", "final"] as const).every((lane) => {
    const items = matches.filter((item) => item.lane === lane)
    const distances = [...new Set(items.map(({ toEnd }) => toEnd!))].sort((x, y) => y - x)
    const tiers = distances.map((distance) => items.filter(({ toEnd }) => toEnd === distance))
    const round = (tier: BracketMatch[]) => tier[0]!.match.round
    return tiers.every((tier, at) => {
      const follows = !numbered || lane === "upper" || lane === "final" || !at
      const ways = new Set(tier.filter(({ loser }) => loser).map(({ loserTo }) => !!loserTo))
      return (
        ways.size < 2 &&
        tier.every(({ match }) => match.round === round(tier)) &&
        (follows || round(tier) === round(tiers[at - 1]!) + 1)
      )
    })
  })
}

/**
 * Whether results stand as a bracket: no team plays on after a second loss, those who play for a place come out of one
 * round and play no further, and where the plan has no links, the rounds are even. Uneven ones lack a match.
 */
export function isSound(bracket: Bracket) {
  const losses = new Map<string, number>()
  for (const { loser, lane } of bracket.matches)
    if (loser && lane !== "place") losses.set(loser, (losses.get(loser) ?? 0) + 1)
  if ([...losses.values()].some((count) => count > 2)) return false
  if (!bracket.matches.some(isLinked) && !hasEvenRounds(bracket)) return false

  const toEnd = new Map(bracket.matches.map((item) => [item.match.key, item.toEnd]))
  return bracket.places.every(({ a, b, loserTo }) => {
    const [one, other] = [toEnd.get(a!.key), toEnd.get(b!.key)]
    return !loserTo && one != null && one === other && (one > 0 || bracket.ends.length > 1)
  })
}

/**
 * Whether the teams a qualifier sends on came as far as each other: the ways that end in one lane are as long. Where
 * they are not, a match between two of those teams is missing.
 */
export function sendsOnEvenly(bracket: Bracket) {
  const byKey = new Map(bracket.matches.map((item) => [item.match.key, item]))
  // Rounds and links that contradict each other may lead a way back to a match it came from: it has no length.
  const length = (item: BracketMatch, behind: BracketMatch[] = []): number => {
    if (behind.includes(item)) return Number.NaN
    const before = [item.a, item.b].flatMap((source) =>
      source?.type === "WINNER" ? [length(byKey.get(source.key)!, [...behind, item])] : [],
    )
    return 1 + Math.max(0, ...before)
  }
  return bracket.ends.every((end) =>
    bracket.ends.every((other) => other.lane !== end.lane || length(other) === length(end)),
  )
}
