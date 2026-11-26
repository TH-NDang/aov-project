import type { Lane } from "@aov/community-contracts"
import { matchWinner } from "./competition-model.ts"
import { countGames, feedScope, type FeedGame, type FeedHero, type FeedPeriod, type GameFeed } from "./game-feed.ts"
import {
  enoughPicks,
  heroLine,
  heroMates,
  heroRecords,
  leastRate,
  type HeroLine,
  type HeroRecord,
  type MetGame,
} from "./hero-model.ts"
import { teamHeroes, teamRecords, teamTally, type TeamRecord } from "./team-draft-model.ts"

/**
 * What a competition is remembered by. Everything here is a game that happened or a count of them; among many pairs and
 * many heroes a striking record is often luck, so no reason is read into one.
 */

export type LeaderKind = "PRESENT" | "PICKED" | "WINNING" | "BANNED"
export type Leader = { kind: LeaderKind; line: HeroLine }

/**
 * Three different heroes that lead a competition: the one seen most, the one picked most, and the one that won most of
 * enough picks; without such a one, the hero banned most. Who was seen or banned most is told by the games that show
 * their bans, so without any there are only the other two.
 */
export function leaders(records: Iterable<HeroRecord>, games: number): Leader[] {
  const lines = [...records].map(heroLine)
  const most = (figure: (line: HeroLine) => number) =>
    lines.filter((line) => figure(line) > 0).sort((x, y) => figure(y) - figure(x))
  const sure = (line: HeroLine) => {
    const least = line.picks >= enoughPicks(games) ? leastRate(line) : 0
    return least > 0.5 ? least : 0
  }
  const lists: [LeaderKind, HeroLine[]][] = [
    ["PRESENT", most((line) => line.seen)],
    ["PICKED", most((line) => line.picks)],
    ["WINNING", most(sure)],
    ["BANNED", most((line) => line.bans)],
  ]
  const shown: Leader[] = []
  for (const [kind, list] of lists) {
    const line = list.find((item) => !shown.some((leader) => leader.line.hero.key === item.hero.key))
    if (line && shown.length < 3) shown.push({ kind, line })
  }
  return shown
}

/** How strong each team was: the share of its games it won, drawn towards half while it played few. */
export function strengths(feed: Pick<GameFeed, "games">): Map<string, number> {
  return new Map(
    teamRecords(feed).map((record) => {
      const { wins, losses } = teamTally(record)
      return [record.teamId, (wins + 2) / (wins + losses + 4)]
    }),
  )
}

/** How likely a team of one strength beats a team of another, nothing else known. */
export const likelihood = (own: number, rival: number) => (own * (1 - rival)) / (own * (1 - rival) + rival * (1 - own))

export type Sides = {
  blue: number
  red: number
  /**
   * How the two sides of the map compare: no further apart than chance makes them, as far apart as the strength of the
   * teams that sat on them explains, or further.
   */
  verdict: "EVEN" | "TEAMS" | "SIDE"
}

/** A difference this many times what chance makes is told; a smaller one is not. */
const TELLING = 1.64

export function sidesOf(feed: Pick<GameFeed, "games">, whole: Pick<GameFeed, "games"> = feed): Sides {
  const decided = feed.games.filter((game) => game.winner)
  const blue = decided.filter((game) => game.winner === "BLUE").length
  const red = decided.length - blue
  if (Math.abs(blue - red) < TELLING * Math.sqrt(decided.length)) return { blue, red, verdict: "EVEN" }
  const strength = strengths(whole)
  const odds = decided.map((game) => {
    const [own, rival] = (["BLUE", "RED"] as const).map(
      (side) => strength.get(game.sides.find((item) => item.side === side)?.teamId ?? "") ?? 0.5,
    )
    return likelihood(own!, rival!)
  })
  const expected = odds.reduce((sum, value) => sum + value, 0)
  const spread = Math.sqrt(odds.reduce((sum, value) => sum + value * (1 - value), 0))
  return { blue, red, verdict: Math.abs(blue - expected) < TELLING * spread ? "TEAMS" : "SIDE" }
}

/** How many games lasted each whole minute, from the shortest to the longest. */
export function lengthColumns(games: FeedGame[]): { minute: number; games: FeedGame[] }[] {
  const timed = games.filter((game) => game.seconds)
  const minuteOf = (game: FeedGame) => Math.floor(game.seconds! / 60)
  const minutes = timed.map(minuteOf)
  if (!minutes.length) return []
  const first = Math.min(...minutes)
  return Array.from({ length: Math.max(...minutes) - first + 1 }, (_, index) => ({
    minute: first + index,
    games: timed.filter((game) => minuteOf(game) === first + index),
  }))
}

/** Games by length, the shortest or the longest first; those of unknown length are left out. */
export const byLength = (games: FeedGame[], order: "short" | "long") =>
  games
    .filter((game) => game.seconds)
    .sort((x, y) => (order === "short" ? x.seconds! - y.seconds! : y.seconds! - x.seconds!))

/** Games won and lost with a hero by one team; `playerId` is who played nearly all of them, where the seats say so. */
export type TeamHeroRecord = {
  teamId: string
  hero: FeedHero
  games: MetGame[]
  wins: number
  losses: number
  playerId: string | null
}

function playerBehind(record: TeamRecord, hero: FeedHero, games: MetGame[]): string | null {
  const ids = new Set(games.map(({ game }) => game.id))
  const counts = new Map<string, number>()
  for (const { game, side } of record.games) {
    const player = ids.has(game.id) && side.picks.find((pick) => pick.hero.key === hero.key)?.playerId
    if (player) counts.set(player, (counts.get(player) ?? 0) + 1)
  }
  const [first] = [...counts].sort((x, y) => y[1] - x[1])
  return first && first[1] >= 0.8 * games.length ? first[0] : null
}

/** The best records of a team with a hero, each team and each hero once; a short record gives way to a longer one. */
export function teamHeroRecords(feed: Pick<GameFeed, "games">, size = 3): TeamHeroRecord[] {
  const enough = Math.max(5, Math.ceil(feed.games.length / 40))
  const taken = new Set<string>()
  return teamRecords(feed)
    .flatMap((record) => teamHeroes(record).map((mate) => ({ record, mate })))
    .filter(({ mate }) => mate.games.length >= enough && mate.wins > mate.losses)
    .sort((x, y) => leastRate(y.mate) - leastRate(x.mate) || y.mate.games.length - x.mate.games.length)
    .filter(({ record, mate }) => {
      if (taken.has(record.teamId) || taken.has(mate.hero.key)) return false
      taken.add(record.teamId).add(mate.hero.key)
      return true
    })
    .slice(0, size)
    .map(({ record, mate: { hero, games, wins, losses } }) => ({
      teamId: record.teamId,
      hero,
      games,
      wins,
      losses,
      playerId: playerBehind(record, hero, games),
    }))
}

export type PairRecord = { heroes: [FeedHero, FeedHero]; games: MetGame[]; wins: number; losses: number }

/**
 * The best records of two heroes on one team, or of one against another, each hero once. A pair needs as many games as
 * a hero's win rate does: among thousands of pairs a short record is striking by luck.
 */
export function pairRecords(
  records: Map<string, HeroRecord>,
  relation: "with" | "against",
  games: number,
  size = 3,
): PairRecord[] {
  const pairs: PairRecord[] = []
  for (const record of records.values())
    for (const mate of heroMates(record, relation)) {
      if (mate.games.length < enoughPicks(games) || mate.wins <= mate.losses) continue
      // A pair on one team is met from both its heroes; it is listed once.
      if (relation === "with" && record.hero.key > mate.hero.key) continue
      pairs.push({ heroes: [record.hero, mate.hero], games: mate.games, wins: mate.wins, losses: mate.losses })
    }
  const taken = new Set<string>()
  return pairs
    .sort((x, y) => leastRate(y) - leastRate(x) || y.games.length - x.games.length)
    .filter(({ heroes }) => {
      if (heroes.some(({ key }) => taken.has(key))) return false
      heroes.forEach(({ key }) => taken.add(key))
      return true
    })
    .slice(0, size)
}

/** The heroes played most in each lane, as many as asked, with what they won there. */
export type LaneHero = { hero: FeedHero; games: number; wins: number; losses: number }

export function laneHeroes(records: Iterable<HeroRecord>): Map<Lane, LaneHero[]> {
  const lanes = new Map<Lane, Map<string, LaneHero>>()
  for (const { hero, picks } of records)
    for (const { pick, won } of picks) {
      if (!pick.lane) continue
      const heroes = lanes.get(pick.lane) ?? new Map<string, LaneHero>()
      lanes.set(pick.lane, heroes)
      const line = heroes.get(hero.key) ?? { hero, games: 0, wins: 0, losses: 0 }
      line.games += 1
      if (won === true) line.wins += 1
      if (won === false) line.losses += 1
      heroes.set(hero.key, line)
    }
  return new Map(
    [...lanes].map(([lane, heroes]) => [
      lane,
      [...heroes.values()].sort((x, y) => y.games - x.games || x.hero.name.localeCompare(y.hero.name)),
    ]),
  )
}

export type Comeback = { seriesId: string; game: FeedGame; winnerId: string; loserId: string; marks: boolean[] }

/** Whether a team has won a match, by its score or by the games it has won of those it could be played over. */
function takesMatch({ entry }: FeedGame, teamId: string, won: number, games: number): boolean {
  const winner = entry && matchWinner(entry)
  if (winner) return (winner === "a" ? entry.result?.teamAId : entry.result?.teamBId) === teamId
  return won >= (entry ? Math.floor(entry.match.bestOf / 2) + 1 : Math.floor(games / 2) + 1)
}

/** Matches won after being two games behind, the newest first; `marks` are the games of the team that came back. */
export function comebacks(feed: Pick<GameFeed, "games">): Comeback[] {
  const series = new Map<string, FeedGame[]>()
  for (const game of feed.games) series.set(game.seriesId, [...(series.get(game.seriesId) ?? []), game])
  return [...series.values()]
    .flatMap((games): Comeback[] => {
      const played = [...games].sort((x, y) => x.number - y.number)
      const teams = [...new Set(played.flatMap((game) => game.sides.flatMap(({ teamId }) => teamId ?? [])))]
      if (teams.length !== 2 || played.some((game) => !game.winner)) return []
      return teams.flatMap((winnerId): Comeback[] => {
        const marks = played.map((game) => game.sides.find((side) => side.teamId === winnerId)?.side === game.winner)
        const won = marks.filter(Boolean).length
        let behind = 0
        let worst = 0
        for (const mark of marks) {
          behind += mark ? -1 : 1
          worst = Math.max(worst, behind)
        }
        if (worst < 2 || !takesMatch(played[0]!, winnerId, won, marks.length)) return []
        const loserId = teams.find((team) => team !== winnerId)!
        return [{ seriesId: played[0]!.seriesId, game: played.at(-1)!, winnerId, loserId, marks }]
      })
    })
    .sort((x, y) => y.game.at - x.game.at)
}

export type Trend = { hero: FeedHero; shares: number[] }
/** A part of a competition, and how many of its games show their bans, which the shares are out of. */
export type TrendPeriod = FeedPeriod & { shown: number }
export type Trends = { periods: TrendPeriod[]; up: Trend[]; down: Trend[] }

/** The least games of a period that shares are read from. */
const ENOUGH_IN_PERIOD = 20
/** How far apart two shares have to be, in what chance makes, before the change is told of one hero among a hundred. */
const TELLING_CHANGE = 2.5

/** The parts of a competition that follow each other: the patches of a stage where it has several, else the stage. */
export const periodLine = (feed: GameFeed): FeedPeriod[] =>
  feed.periods.filter(
    (period) => period.patch || !feed.periods.some((item) => item.patch && item.stage.code === period.stage.code),
  )

/**
 * Heroes seen much more, or much less, in the last part of a competition than in its first; only games that show their
 * bans say who was seen.
 */
export function trends(feed: GameFeed): Trends | null {
  const parts = periodLine(feed)
    .map((period) => ({ period, own: feedScope(feed, period.key).feed }))
    .map(({ period, own }) => ({ own, period: { ...period, shown: countGames(own.games).shown } }))
    .filter(({ period }) => period.shown >= ENOUGH_IN_PERIOD)
  if (parts.length < 2) return null
  const periods = parts.map(({ period }) => period)
  const counted = parts.map(({ own, period }) => ({
    games: period.shown,
    seen: new Map([...heroRecords(own).values()].map((record) => [record.hero.key, heroLine(record).seen])),
  }))
  const [first, last] = [counted[0]!, counted.at(-1)!]
  const lines = feed.heroes.map((hero) => {
    const [before, after] = [first, last].map(({ games, seen }) => ({ games, seen: seen.get(hero.key) ?? 0 }))
    const pooled = (before!.seen + after!.seen) / (before!.games + after!.games)
    const spread = Math.sqrt(pooled * (1 - pooled) * (1 / before!.games + 1 / after!.games))
    const change = after!.seen / after!.games - before!.seen / before!.games
    return {
      hero,
      shares: counted.map(({ games, seen }) => (seen.get(hero.key) ?? 0) / games),
      change,
      told: spread > 0 && Math.abs(change) >= TELLING_CHANGE * spread,
    }
  })
  const told = (sign: 1 | -1) =>
    lines
      .filter((line) => line.told && sign * line.change > 0)
      .sort((x, y) => sign * (y.change - x.change))
      .map(({ hero, shares }): Trend => ({ hero, shares }))
  const [up, down] = [told(1), told(-1)]
  return up.length || down.length ? { periods, up, down } : null
}

/** Heroes picked in a single game, with that game and its result, the newest first. */
export function pickedOnce(records: Map<string, HeroRecord>) {
  return [...records.values()]
    .filter(({ picks }) => picks.length === 1)
    .map(({ hero, picks }) => ({ hero, game: picks[0]!.game, won: picks[0]!.won, teamId: picks[0]!.side.teamId }))
    .sort((x, y) => y.game.at - x.game.at)
}
