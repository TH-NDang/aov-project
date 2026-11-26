import type { Side } from "@aov/community-contracts"
import {
  asksSides,
  choices,
  findGames,
  heroChoices,
  namesSide,
  NOTHING_ASKED,
  settled,
  withHero,
  type FoundGame,
  type HeroRole,
  type Question,
} from "./finder-model.ts"
import { heroByKey, showsBans, type FeedGame, type FeedHero, type GameFeed } from "./game-feed.ts"
import { tally, type Tally } from "./hero-model.ts"
import { banHabits } from "./team-draft-model.ts"

/** What side A of the found games won and lost. */
export const foundTally = (games: FoundGame[]): Tally => tally(games.map(({ won }) => won))

/**
 * Whether a question has a score worth reading: it tells the two sides apart by who played. The record of a side that
 * only banned something is the record of whoever banned it, and says nothing about the hero; a question that asks for
 * the result, or for the best player, who comes from the side that won, has given its score.
 */
export const hasScore = (question: Question) =>
  asksSides(question) &&
  question.won == null &&
  !question.mvp &&
  !!(question.team || question.opp || question.player || question.pick.length || question.vs.length)

/**
 * How many games might answer a question about bans if anybody had written down who was banned in them: those that
 * answer the rest of it and did not pick a hero it asks banned.
 */
export function unseenBans(games: FeedGame[], question: Question): number {
  const banned = new Set([...question.ban, ...question.banA, ...question.banB].map(({ key }) => key))
  if (!banned.size) return 0
  const open = games.filter(
    (game) => !showsBans(game) && !game.sides.some(({ picks }) => picks.some(({ hero }) => banned.has(hero.key))),
  )
  return findGames(open, settled({ ...question, ban: [], banA: [], banB: [] })).length
}

/**
 * How many games a question about a player leaves out although the player was their MVP, because no seat of theirs names
 * the player. Next to one hero none is: only a seat says who had it.
 */
export function unseenMvps(games: FeedGame[], question: Question): number {
  if (!question.player || question.mvp) return 0
  const found = new Set(findGames(games, question).map(({ game }) => game.id))
  return findGames(games, { ...question, mvp: true }).filter(({ game }) => !found.has(game.id)).length
}

/** How many games each side of the map won. */
export const sideWins = (games: Pick<FeedGame, "winner">[]): Record<Side, number> => ({
  BLUE: games.filter(({ winner }) => winner === "BLUE").length,
  RED: games.filter(({ winner }) => winner === "RED").length,
})

/** A game with the first team of its match as side A, for lists that are about neither side. */
export function inMatchOrder(found: FoundGame): FoundGame {
  const { game, a, b } = found
  const first = game.entry?.result?.teamAId || game.entry?.match.a.teamId
  if (!b || !first || a.teamId === first || b.teamId !== first) return found
  return { game, a: b, b: a, won: found.won == null ? null : !found.won }
}

/** The same question seen from the other side. What was asked of one player or one seat stays behind. */
export const turnedAround = (question: Question): Question =>
  settled({
    ...question,
    team: question.opp,
    opp: question.team,
    pick: question.vs,
    vs: question.pick,
    banA: question.banB,
    banB: question.banA,
    player: null,
    lane: null,
    turn: question.pick.length || question.vs.length ? null : question.turn,
    side: question.side && (question.side === "BLUE" ? "RED" : "BLUE"),
    won: question.won == null ? null : !question.won,
  })

/** What the filters of a list ask for, let go of. */
export const UNFILTERED: Partial<Question> = {
  won: null,
  side: null,
  min: null,
  max: null,
  lane: null,
  player: null,
  mvp: false,
  duel: false,
}

/** Everything that has no seat on the draft board, let go of. */
export const SEATLESS_NOTHING: Partial<Question> = { ...UNFILTERED, turn: null, from: null, to: null }

/** The question a choice of a filter leads to; "all" lets go of the filter. */
export function filtered(question: Question, key: string, value: string): Question {
  const chosen = value === "all" ? null : value
  if (key === "won") return { ...question, won: chosen == null ? null : chosen === "win" }
  if (key === "side") return { ...question, side: chosen as Side | null }
  if (key === "lane") return { ...question, lane: chosen as Question["lane"] }
  if (key === "player") return { ...question, player: chosen, mvp: false }
  if (key === "duel") return { ...question, duel: chosen != null }
  const length = LENGTHS.find((item) => item.key === value)
  return { ...question, min: length?.min ?? null, max: length?.max ?? null }
}

/**
 * The players a filter offers with the games each leaves, most first. The player asked about comes before them where no
 * seat names that player, and then without a number: what is asked for can always be let go of.
 */
export function playerChoices(games: FeedGame[], question: Question): [player: string, games: number | null][] {
  const { player } = question
  const named = [...choices(games, question, "player")].sort((x, y) => y[1] - x[1])
  return player && !named.some(([id]) => id === player) ? [[player, null], ...named] : named
}

/** The team each player sat for, the last one while games come newest first. */
export function playerTeams(games: Pick<FeedGame, "sides">[]): Map<string, string> {
  const teams = new Map<string, string>()
  for (const { teamId, picks } of games.flatMap(({ sides }) => sides))
    for (const { playerId } of picks) if (playerId && teamId && !teams.has(playerId)) teams.set(playerId, teamId)
  return teams
}

/** A choice that narrows the games found, with the question it leads to and what side A won and lost there. */
export type Suggestion = Tally & { question: Question }
export type TeamSuggestion = Suggestion & { teamId: string }
export type HeroSuggestion = Suggestion & { hero: FeedHero }
export type Suggestions = { teams: TeamSuggestion[]; mates: HeroSuggestion[]; rivals: HeroSuggestion[] }

/** The games that need narrowing, and the least that a suggestion leaves. */
const MANY = 5
const LEFT = 2

/**
 * What would narrow the games found in one step: a team for side A, a hero beside those it picked, a hero it met. A
 * choice every game found already has narrows nothing, and one that leaves a single game is quicker read in the list.
 * Without a side, whoever picked a hero counts.
 */
export function suggestions(
  feed: Pick<GameFeed, "games" | "heroes">,
  question: Question,
  found: number,
  size = 6,
): Suggestions {
  const { games } = feed
  if (found < MANY) return { teams: [], mates: [], rivals: [] }
  const narrowing = (counts: Map<string, number>, ask: (key: string) => Question | null) =>
    [...counts]
      .filter(([, count]) => count >= LEFT && count < found)
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
      .slice(0, size)
      .flatMap(([key]) => {
        const next = ask(key)
        return next ? [{ key, question: next, ...foundTally(findGames(games, next)) }] : []
      })
  const heroes = (role: HeroRole): HeroSuggestion[] =>
    narrowing(heroChoices(games, question, role), (key) => {
      const hero = heroByKey(feed, key)
      return hero && withHero(question, role, hero)
    }).map(({ key, ...item }) => ({ ...item, hero: heroByKey(feed, key)! }))
  return {
    teams: question.team
      ? []
      : narrowing(choices(games, question, "team"), (team) => settled({ ...question, team })).map(
          ({ key, ...item }) => ({
            ...item,
            teamId: key,
          }),
        ),
    mates: heroes("pick"),
    rivals: namesSide(question) ? heroes("vs") : [],
  }
}

/** Two heroes who met most often, the one seen more on side A. */
function commonMeeting(games: FeedGame[]): Question | null {
  const met = new Map<string, { heroes: [FeedHero, FeedHero]; games: number }>()
  const picks = new Map<string, number>()
  for (const { sides } of games) {
    const [blue, red] = sides
    for (const { hero } of sides.flatMap((side) => side.picks)) picks.set(hero.key, (picks.get(hero.key) ?? 0) + 1)
    for (const { hero: x } of blue?.picks ?? [])
      for (const { hero: y } of red?.picks ?? []) {
        const pair: [FeedHero, FeedHero] = x.key < y.key ? [x, y] : [y, x]
        const key = pair.map((hero) => hero.key).join(" ")
        const known = met.get(key) ?? { heroes: pair, games: 0 }
        known.games += 1
        met.set(key, known)
      }
  }
  const [most] = [...met.values()].sort((x, y) => y.games - x.games)
  if (!most || most.games < 2) return null
  const [first, second] = most.heroes.sort((x, y) => (picks.get(y.key) ?? 0) - (picks.get(x.key) ?? 0))
  return { ...NOTHING_ASKED, pick: [first!], vs: [second!] }
}

/** The games a ban needs before it is called a habit of a team. */
const A_HABIT = 3

/** The ban one team makes the furthest more often than the others do. */
function tellingBan(games: FeedGame[]): Question | null {
  const teams = new Set(games.flatMap(({ sides }) => sides.flatMap(({ teamId }) => teamId ?? [])))
  const [habit] = [...teams]
    .flatMap((team) => banHabits({ games }, team, "own").map((ban) => ({ ...ban, team })))
    .filter((ban) => ban.games >= A_HABIT)
    .sort((x, y) => y.share - y.elsewhere - (x.share - x.elsewhere) || y.games - x.games)
  return habit ? { ...NOTHING_ASKED, team: habit.team, banA: [habit.hero] } : null
}

/**
 * Three questions worth asking of a competition, read from its games: two heroes who often met, a ban one team makes
 * more than the others, and its shortest games, or else its longest. Each comes with the games that answer it.
 */
export function examples(games: FeedGame[]): { question: Question; games: number }[] {
  const lengths = lengthCounts(findGames(games, NOTHING_ASKED)).filter(
    (length) => length.games > 0 && length.games < games.length,
  )
  const length = lengths.find(({ min }) => min == null) ?? lengths.at(-1)
  return [
    commonMeeting(games),
    tellingBan(games),
    length ? { ...NOTHING_ASKED, min: length.min, max: length.max } : null,
  ].flatMap((question) => (question ? [{ question, games: findGames(games, question).length }] : []))
}

/** The lengths a reader asks about, in whole minutes, both included. */
export const LENGTHS: { key: string; min: number | null; max: number | null }[] = [
  { key: "9", min: null, max: 9 },
  { key: "10", min: 10, max: 14 },
  { key: "15", min: 15, max: 19 },
  { key: "20", min: 20, max: null },
]

/** The length a question asks about, when it is one of those offered. */
export const lengthOf = ({ min, max }: Pick<Question, "min" | "max">) =>
  LENGTHS.find((length) => length.min === min && length.max === max && (min != null || max != null)) ?? null

/** How many of some games lasted each of the lengths a reader asks about. */
export const lengthCounts = (games: FoundGame[]) =>
  LENGTHS.map((length) => ({
    ...length,
    games: games.filter(({ game: { seconds } }) => {
      if (!seconds) return false
      const minute = Math.floor(seconds / 60)
      return minute >= (length.min ?? 0) && minute <= (length.max ?? Infinity)
    }).length,
  }))
