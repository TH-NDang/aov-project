import type { Lane, Side } from "@aov/community-contracts"
import {
  facing,
  showsBans,
  wonBy,
  type Counted,
  type FeedBan,
  type FeedGame,
  type FeedHero,
  type FeedPick,
  type FeedSide,
  type GameFeed,
} from "./game-feed.ts"
import { LANES } from "./tournament-model.ts"

/** A game a hero was picked in, seen from the side that picked it. */
export type HeroPick = { game: FeedGame; side: FeedSide; other: FeedSide | null; pick: FeedPick; won: boolean | null }
/** A game a hero was banned in: `side` banned it, `other` could not pick it. */
export type HeroBan = { game: FeedGame; side: FeedSide; other: FeedSide | null; ban: FeedBan }
/** What became of one hero, the game played first coming first. */
export type HeroRecord = { hero: FeedHero; picks: HeroPick[]; bans: HeroBan[] }

/** Games won and lost; a game without a recorded winner is neither. */
export type Tally = { games: number; wins: number; losses: number }

export const tally = (results: Iterable<boolean | null>): Tally => {
  const count = { games: 0, wins: 0, losses: 0 }
  for (const won of results) {
    count.games += 1
    if (won === true) count.wins += 1
    if (won === false) count.losses += 1
  }
  return count
}

/** A share in whole percent, the way a page reads it. */
export const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

/**
 * The picks a win rate needs before it says something: one game in twenty, and five at least. A hero picked once and
 * won once is no champion of its competition.
 */
export const enoughPicks = (games: number) => Math.max(5, Math.ceil(games / 20))

/** The least win rate a record stands for at 90%, so that 9–1 says more than 2–0. */
export function leastRate({ wins, losses }: Pick<Tally, "wins" | "losses">) {
  const n = wins + losses
  if (!n) return 0
  const z = 1.64
  const rate = wins / n
  return (rate + (z * z) / (2 * n) - z * Math.sqrt((rate * (1 - rate)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n)
}

/** Every hero the games of a feed picked or banned, by its key. */
export function heroRecords(feed: Pick<GameFeed, "games">): Map<string, HeroRecord> {
  const records = new Map<string, HeroRecord>()
  const of = (hero: FeedHero) => {
    const known = records.get(hero.key) ?? { hero, picks: [], bans: [] }
    records.set(hero.key, known)
    return known
  }
  for (const game of [...feed.games].reverse())
    for (const side of game.sides) {
      const other = facing(game, side)
      for (const pick of side.picks) of(pick.hero).picks.push({ game, side, other, pick, won: wonBy(game, side) })
      for (const ban of side.bans) of(ban.hero).bans.push({ game, side, other, ban })
    }
  return records
}

export type HeroLine = {
  hero: FeedHero
  picks: number
  wins: number
  losses: number
  bans: number
  /** Games it was picked or banned in. */
  presence: number
  /** Those of them that show their bans: the others only tell of the heroes they picked. */
  seen: number
  blue: Tally
  red: Tally
  /** The lanes it was played in, the usual one first. */
  lanes: { lane: Lane; games: number }[]
}

/** How often each lane was played, the usual one first. */
export function laneCounts(picks: Iterable<{ pick: Pick<FeedPick, "lane"> }>) {
  const counts = new Map<Lane, number>()
  for (const { pick } of picks) if (pick.lane) counts.set(pick.lane, (counts.get(pick.lane) ?? 0) + 1)
  return [...counts]
    .map(([lane, games]) => ({ lane, games }))
    .sort((x, y) => y.games - x.games || LANES.indexOf(x.lane) - LANES.indexOf(y.lane))
}

/** How many games a list speaks of, each counted once. */
export const gamesIn = (list: { game: FeedGame }[]) => new Set(list.map(({ game }) => game.id)).size

/** Games a hero was picked or banned in, and those of them that show their bans. */
export function presenceOf({ picks, bans }: Pick<HeroRecord, "picks" | "bans">) {
  const present = [...picks, ...bans]
  return { presence: gamesIn(present), seen: gamesIn(present.filter(({ game }) => showsBans(game))) }
}

const onSide = (picks: HeroPick[], side: Side) =>
  tally(picks.filter((pick) => pick.side.side === side).map(({ won }) => won))

export function heroLine({ hero, picks, bans }: HeroRecord): HeroLine {
  const { wins, losses } = tally(picks.map(({ won }) => won))
  return {
    hero,
    picks: picks.length,
    wins,
    losses,
    bans: bans.length,
    ...presenceOf({ picks, bans }),
    blue: onSide(picks, "BLUE"),
    red: onSide(picks, "RED"),
    lanes: laneCounts(picks),
  }
}

/** What became of a hero in the games counted: what a bar as long as all of them is made of. */
export type Fate = {
  games: number
  picks: number
  wins: number
  losses: number
  bans: number
  /** Games that neither picked it nor show their bans: nobody knows whether it was banned in them. */
  unknown: number
}

/** The games of which nobody knows whether they banned a hero. */
export const unknownGames = ({ games, shown }: Counted, { presence, seen }: Pick<HeroLine, "presence" | "seen">) =>
  games - shown - (presence - seen)

export const lineFate = (line: HeroLine, counted: Counted): Fate => ({
  games: counted.games,
  picks: line.picks,
  wins: line.wins,
  losses: line.losses,
  bans: line.bans,
  unknown: unknownGames(counted, line),
})

export type HeroOrder = "presence" | "picks" | "wins" | "bans"

/** Whether an order is by something that only games that show their bans tell. */
export const needsBans = (by: HeroOrder) => by === "presence" || by === "bans"

const FIGURE: Record<HeroOrder, (line: HeroLine) => number> = {
  presence: (line) => line.seen,
  picks: (line) => line.picks,
  wins: (line) => (line.wins + line.losses ? line.wins / (line.wins + line.losses) : -1),
  bans: (line) => line.bans,
}

/** Heroes from the most to the fewest; by win rate, those with too few picks for one come after the others. */
export function sortLines(lines: HeroLine[], by: HeroOrder, games: number): HeroLine[] {
  const enough = (line: HeroLine) => Number(by !== "wins" || line.picks >= enoughPicks(games))
  return [...lines].sort(
    (x, y) =>
      enough(y) - enough(x) ||
      (by === "wins" && !enough(x) ? 0 : FIGURE[by](y) - FIGURE[by](x)) ||
      y.presence - x.presence ||
      y.picks - x.picks ||
      x.hero.name.localeCompare(y.hero.name),
  )
}

/** Every hero of some games, the one seen most first. */
export const heroLines = (records: Map<string, HeroRecord>, games: number) =>
  sortLines([...records.values()].map(heroLine), "presence", games)

export type Shelf = {
  /** The share or the number of games its heroes have at least; null for those with too few picks to compare. */
  from: number | null
  below: number | null
  lines: HeroLine[]
}

/** Where the shelves of each order begin: shares of games, and win rates in percent. */
const SHELVES: Record<HeroOrder, number[]> = {
  presence: [90, 50, 25, 5, 0],
  picks: [25, 10, 3, 0],
  wins: [60, 40, 0],
  bans: [50, 25, 10, 1, 0],
}

/**
 * Heroes set out on shelves by how often they were seen, picked, banned or won, in shares of all games; how often they
 * were seen or banned, of those that show their bans. A hero nobody picked stands on no shelf of picks or wins; by wins,
 * those with too few picks for a rate close the list.
 */
export function heroShelves(lines: HeroLine[], by: HeroOrder, { games, shown }: Counted): Shelf[] {
  const listed = lines.filter((line) => needsBans(by) || line.picks > 0)
  const compares = (line: HeroLine) =>
    by !== "wins" || (line.picks >= enoughPicks(games) && line.wins + line.losses > 0)
  const compared = listed.filter(compares)
  const rest = listed.filter((line) => !compares(line))
  const all = needsBans(by) ? shown : games
  const share = (line: HeroLine) => (by === "wins" ? 100 * FIGURE.wins(line) : (100 * FIGURE[by](line)) / (all || 1))
  const shelves = SHELVES[by].map((from, at): Shelf => {
    const below = at ? SHELVES[by][at - 1]! : null
    return {
      from,
      below,
      lines: sortLines(
        compared.filter((line) => share(line) >= from && (below == null || share(line) < below)),
        by,
        games,
      ),
    }
  })
  const few: Shelf = { from: null, below: null, lines: sortLines(rest, "picks", games) }
  return [...shelves, few].filter((shelf) => shelf.lines.length > 0)
}

export type HeroTeam = {
  teamId: string
  picks: HeroPick[]
  /** Who played it for the team, most games first; games without a known player are left out. */
  players: { playerId: string; games: number }[]
  /** Games the team banned it in, and games it was banned in against the team. */
  bans: number
  bannedAgainst: number
}

function playersOf(picks: HeroPick[]) {
  const counts = new Map<string, number>()
  for (const { pick } of picks) if (pick.playerId) counts.set(pick.playerId, (counts.get(pick.playerId) ?? 0) + 1)
  return [...counts].map(([playerId, games]) => ({ playerId, games })).sort((x, y) => y.games - x.games)
}

/** Every team that picked or banned a hero or had it banned against, the one that played it most first. */
export function heroTeams({ picks, bans }: HeroRecord): HeroTeam[] {
  const teams = new Map<string, HeroTeam>()
  const of = (teamId: string | null | undefined) => {
    if (!teamId) return null
    const known = teams.get(teamId) ?? { teamId, picks: [], players: [], bans: 0, bannedAgainst: 0 }
    teams.set(teamId, known)
    return known
  }
  for (const pick of picks) of(pick.side.teamId)?.picks.push(pick)
  for (const ban of bans) {
    const by = of(ban.side.teamId)
    const against = of(ban.other?.teamId)
    if (by) by.bans += 1
    if (against) against.bannedAgainst += 1
  }
  return [...teams.values()]
    .map((team) => ({ ...team, players: playersOf(team.picks) }))
    .sort((x, y) => y.picks.length - x.picks.length || y.bans + y.bannedAgainst - (x.bans + x.bannedAgainst))
}

export type MetGame = { game: FeedGame; won: boolean | null }
/** The games two heroes were both in, the first played coming first; results are those of the hero asked about. */
export type HeroMate = { hero: FeedHero; games: MetGame[]; wins: number; losses: number }

/** Who stood beside a hero, against it, or against it in the same lane. */
export type Relation = "with" | "against" | "lane"

/** The heroes picked together with a hero, or against it, the one met most often first. */
export function heroMates({ hero, picks }: HeroRecord, relation: Relation): HeroMate[] {
  const met = new Map<string, { hero: FeedHero; games: MetGame[] }>()
  for (const { game, side, other, pick, won } of picks)
    for (const { hero: mate, lane } of (relation === "with" ? side : other)?.picks ?? []) {
      if (mate.key === hero.key) continue
      if (relation === "lane" && (!lane || lane !== pick.lane)) continue
      const known = met.get(mate.key) ?? { hero: mate, games: [] }
      known.games.push({ game, won })
      met.set(mate.key, known)
    }
  return [...met.values()]
    .map((mate) => {
      const { wins, losses } = tally(mate.games.map(({ won }) => won))
      return { ...mate, wins, losses }
    })
    .sort((x, y) => y.games.length - x.games.length || x.hero.name.localeCompare(y.hero.name))
}
