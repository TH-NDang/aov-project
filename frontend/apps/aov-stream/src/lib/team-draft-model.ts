import type { Lane, Side } from "@aov/community-contracts"
import {
  averageSeconds,
  facing,
  showsBans,
  wonBy,
  type FeedGame,
  type FeedHero,
  type FeedSide,
  type GameFeed,
} from "./game-feed.ts"
import { laneCounts, tally, type HeroMate, type Tally } from "./hero-model.ts"
import { LANES } from "./tournament-model.ts"

/** A game of a team, seen from its side. */
export type TeamGame = { game: FeedGame; side: FeedSide; other: FeedSide | null; won: boolean | null }
/** The games of one team, the first played coming first. */
export type TeamRecord = { teamId: string; games: TeamGame[] }

/** Every team of a feed, the one that won the greater share of its games first. */
export function teamRecords(feed: Pick<GameFeed, "games">): TeamRecord[] {
  const records = new Map<string, TeamRecord>()
  for (const game of [...feed.games].reverse())
    for (const side of game.sides) {
      if (!side.teamId) continue
      const record = records.get(side.teamId) ?? { teamId: side.teamId, games: [] }
      record.games.push({ game, side, other: facing(game, side), won: wonBy(game, side) })
      records.set(side.teamId, record)
    }
  const rate = (record: TeamRecord) => {
    const { wins, losses } = teamTally(record)
    return wins + losses ? wins / (wins + losses) : 0
  }
  return [...records.values()].sort((x, y) => rate(y) - rate(x) || y.games.length - x.games.length)
}

export const teamTally = ({ games }: Pick<TeamRecord, "games">): Tally => tally(games.map(({ won }) => won))

/** What a team won and lost on one side of the map. */
export const sideTally = ({ games }: Pick<TeamRecord, "games">, side: Side): Tally =>
  tally(games.filter((game) => game.side.side === side).map(({ won }) => won))

/** The average length in seconds of the games a team won or lost; null while no length is known. */
export const averageLength = ({ games }: Pick<TeamRecord, "games">, won: boolean): number | null =>
  averageSeconds(games.flatMap(({ game, won: result }) => (result === won ? game : [])))

/** The heroes a team picked with its result in each of their games, the usual ones first. */
export function teamHeroes({ games }: Pick<TeamRecord, "games">): HeroMate[] {
  const heroes = new Map<string, HeroMate>()
  for (const { game, side, won } of games)
    for (const { hero } of side.picks) {
      const known = heroes.get(hero.key) ?? { hero, games: [], wins: 0, losses: 0 }
      known.games.push({ game, won })
      if (won === true) known.wins += 1
      if (won === false) known.losses += 1
      heroes.set(hero.key, known)
    }
  return [...heroes.values()].sort(
    (x, y) => y.games.length - x.games.length || y.wins - x.wins || x.hero.name.localeCompare(y.hero.name),
  )
}

/** The games a hero needs with a team before its record says something. */
export const enoughForTeam = (games: number) => Math.max(3, Math.min(5, Math.ceil(games / 16)))

/** How many games of a team show who was banned. */
export const shownGames = ({ games }: Pick<TeamRecord, "games">) => games.filter(({ game }) => showsBans(game)).length

export type BanHabit = { hero: FeedHero; games: number; share: number; elsewhere: number }

/**
 * The heroes a team bans, or others ban against it, by how much more often than the rest of the competition does.
 * Shares are of the games that show their bans: 0.28 is one of them in about four.
 */
export function banHabits(feed: Pick<GameFeed, "games">, teamId: string, whose: "own" | "against"): BanHabit[] {
  const counts = new Map<string, { hero: FeedHero; here: number; there: number }>()
  let here = 0
  let there = 0
  for (const game of feed.games.filter(showsBans))
    for (const side of game.sides) {
      const party = whose === "own" ? side : facing(game, side)
      const mine = party?.teamId === teamId
      if (mine) here += 1
      else there += 1
      for (const { hero } of side.bans) {
        const known = counts.get(hero.key) ?? { hero, here: 0, there: 0 }
        if (mine) known.here += 1
        else known.there += 1
        counts.set(hero.key, known)
      }
    }
  return [...counts.values()]
    .filter((item) => item.here > 0)
    .map(({ hero, here: games, there: rest }) => ({
      hero,
      games,
      share: games / (here || 1),
      elsewhere: rest / (there || 1),
    }))
    .sort((x, y) => y.share - y.elsewhere - (x.share - x.elsewhere) || y.games - x.games)
}

/** In how many matches of a team a hero of its was picked; a team may not pick it twice in a match. */
export const matchesWith = ({ games }: Pick<HeroMate, "games">) => new Set(games.map(({ game }) => game.seriesId)).size

/** How many matches a team played. */
export const teamMatches = ({ games }: Pick<TeamRecord, "games">) =>
  new Set(games.map(({ game }) => game.seriesId)).size

/** How many of the seats of a team name who played them. */
export function namedSeats({ games }: Pick<TeamRecord, "games">) {
  const seats = games.flatMap(({ side }) => side.picks)
  return { named: seats.filter(({ playerId }) => playerId).length, seats: seats.length }
}

export type PlayerPool = {
  playerId: string
  lane: Lane | null
  heroes: HeroMate[]
} & Tally

/** The heroes each player of a team played, in lane order, the player with more games first. */
export function playerPools(record: Pick<TeamRecord, "games">): PlayerPool[] {
  const seats = new Map<string, { game: FeedGame; pick: FeedSide["picks"][number]; won: boolean | null }[]>()
  for (const { game, side, won } of record.games)
    for (const pick of side.picks)
      if (pick.playerId) seats.set(pick.playerId, [...(seats.get(pick.playerId) ?? []), { game, pick, won }])
  return [...seats]
    .map(([playerId, own]): PlayerPool => {
      const heroes = new Map<string, HeroMate>()
      for (const { game, pick, won } of own) {
        const known = heroes.get(pick.hero.key) ?? { hero: pick.hero, games: [], wins: 0, losses: 0 }
        known.games.push({ game, won })
        if (won === true) known.wins += 1
        if (won === false) known.losses += 1
        heroes.set(pick.hero.key, known)
      }
      return {
        playerId,
        lane: laneCounts(own)[0]?.lane ?? null,
        ...tally(own.map(({ won }) => won)),
        heroes: [...heroes.values()].sort((x, y) => y.games.length - x.games.length || y.wins - x.wins),
      }
    })
    .sort(
      (x, y) =>
        (x.lane ? LANES.indexOf(x.lane) : LANES.length) - (y.lane ? LANES.indexOf(y.lane) : LANES.length) ||
        y.games - x.games,
    )
}

export type MvpRecord = { playerId: string; games: FeedGame[]; teamId: string | null }

/**
 * The players named the best of a game, the most often first. The game names them, whether or not a seat does; they
 * play for the side that won.
 */
export function mvpRecords({ games }: Pick<GameFeed, "games">): MvpRecord[] {
  const records = new Map<string, MvpRecord>()
  for (const game of games) {
    if (!game.mvpId) continue
    const record = records.get(game.mvpId) ?? { playerId: game.mvpId, games: [], teamId: null }
    record.games.push(game)
    record.teamId ??= game.sides.find(({ side }) => side === game.winner)?.teamId ?? null
    records.set(game.mvpId, record)
  }
  return [...records.values()].sort((x, y) => y.games.length - x.games.length)
}
