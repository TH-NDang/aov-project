import type { CompetitionView, Lane } from "@aov/community-contracts"
import { bracketTeams, journeyEnd, teamJourney } from "./bracket-journey.ts"
import { stageBracket } from "./bracket-model.ts"
import { capital } from "./capital.ts"
import { finalTable } from "./champion-model.ts"
import { isElimination, matchWinner, playedOrder } from "./competition-model.ts"
import { findGames, NOTHING_ASKED } from "./finder-model.ts"
import { foundTally, LENGTHS } from "./found-model.ts"
import type { FeedGame, FeedPeriod, GameFeed } from "./game-feed.ts"
import type { HeroMate, Tally } from "./hero-model.ts"
import { competitionMatches } from "./match-model.ts"
import { matchRound } from "./match-schedule.ts"
import { namesOf } from "./question-words.ts"
import { standingGroups } from "./standings-model.ts"
import {
  banHabits,
  enoughForTeam,
  matchesWith,
  shownGames,
  teamHeroes,
  type BanHabit,
  type PlayerPool,
  type TeamGame,
  type TeamRecord,
} from "./team-draft-model.ts"
import { clock, LANES } from "./tournament-model.ts"

type Say = (vi: string, en: string) => string
type Games = Pick<TeamRecord, "games">

/**
 * The teams of the bracket that ends the given stages, the champion first. A bracket that has no champion, because it is
 * still played or only sends teams on, places nobody.
 */
function bracketPlaces(view: CompetitionView, codes: string[]): string[] {
  const { plan } = view.content
  const decided = new Set(
    competitionMatches([view]).flatMap((entry) => (matchWinner(entry) ? [entry.match.stageCode] : [])),
  )
  const last = playedOrder(plan.stages, plan.matches)
    .filter(({ code }) => codes.includes(code) && decided.has(code))
    .at(-1)
  if (!last || !isElimination(last)) return []
  const layout = stageBracket(view, last.code)
  const teams = bracketTeams(layout)
  return teams[0] && journeyEnd(layout, teamJourney(layout, teams[0])) === "champion" ? teams : []
}

/** In how many tables each team played, and its rank in the last of them. */
function tablePlaces(view: CompetitionView, codes: string[]) {
  const { plan, standings } = view.content
  const order = playedOrder(plan.stages, plan.matches).map(({ code }) => code)
  const places = new Map<string, { tables: number; rank: number }>()
  for (const table of standings
    .filter(({ stageCode }) => codes.includes(stageCode))
    .sort((x, y) => order.indexOf(x.stageCode) - order.indexOf(y.stageCode)))
    for (const { rows } of standingGroups(view, table))
      for (const { teamId, rank, played } of rows)
        if (played) places.set(teamId, { tables: (places.get(teamId)?.tables ?? 0) + 1, rank })
  return places
}

/**
 * Teams in the order a competition left them: by its final table, by how far each went in the bracket that ends it, then
 * by the last table each played in. A stage is ordered by itself. Weeks under one patch have no table, so they keep the
 * order given, and so do teams nothing tells apart.
 */
export function clubOrder(view: CompetitionView, records: TeamRecord[], period: FeedPeriod | null): TeamRecord[] {
  if (period?.patch) return records
  const codes = period ? [period.stage.code] : view.content.plan.stages.map(({ code }) => code)
  const final = period ? [] : finalTable(view).map(({ team }) => team.id)
  const bracket = bracketPlaces(view, codes)
  const tables = tablePlaces(view, codes)
  const at = (list: (string | null)[], teamId: string) => {
    const index = list.indexOf(teamId)
    return index < 0 ? list.length : index
  }
  const places = new Map(
    records.map(({ teamId }) => {
      const table = tables.get(teamId)
      return [
        teamId,
        [at(final, teamId), at(bracket, teamId), -(table?.tables ?? 0), table?.rank ?? Number.MAX_SAFE_INTEGER],
      ]
    }),
  )
  return [...records].sort((x, y) => {
    const [first, second] = [places.get(x.teamId)!, places.get(y.teamId)!]
    return first.map((place, index) => place - second[index]!).find((difference) => difference !== 0) ?? 0
  })
}

const startsMatch = (games: TeamGame[], index: number) =>
  index > 0 && games[index]!.game.seriesId !== games[index - 1]!.game.seriesId

/** The games of a season as marks; the first game of another match stands apart from the one before. */
export const seasonMarks = ({ games }: Games) =>
  games.map(({ won }, index) => ({ won, gap: startsMatch(games, index) }))

/** The steps of space before another match, and before another stage. */
const MATCH_STEPS = 1
const STAGE_STEPS = 4

/** How many steps of space stand before each game of a season, those before the earlier games included. */
export function seasonSteps({ games }: Games): number[] {
  let steps = 0
  return games.map(({ game }, index) => {
    if (startsMatch(games, index)) steps += games[index - 1]!.game.stage === game.stage ? MATCH_STEPS : STAGE_STEPS
    return steps
  })
}

/** The game whose bar stands nearest to `x` in a season `width` wide, where a step of space is `step` wide. */
export function barAt(steps: number[], x: number, width: number, step: number): number {
  const bar = (width - (steps.at(-1) ?? 0) * step) / steps.length
  const away = steps.map((before, index) => Math.abs((index + 0.5) * bar + before * step - x))
  return Math.max(0, away.indexOf(Math.min(...away)))
}

/** A stage of a season: how many games it holds, and how many steps of space stand from its first one to the next stage. */
export type SeasonStage = { code: string | null; games: number; steps: number }

export function seasonStages(record: Games): SeasonStage[] {
  const steps = seasonSteps(record)
  const starts = record.games.flatMap(({ game }, index) =>
    index > 0 && record.games[index - 1]!.game.stage === game.stage ? [] : [index],
  )
  return starts.map((start, index) => {
    const next = starts[index + 1] ?? record.games.length
    return {
      code: record.games[start]!.game.stage,
      games: next - start,
      steps: (steps[next] ?? steps.at(-1)!) - steps[start]!,
    }
  })
}

/** A name inside a sentence: its first letter is small, unless the name is an abbreviation. */
export const inSentence = (name: string, languageTag: string) =>
  /^\p{Lu}\p{Ll}/u.test(name) ? name[0]!.toLocaleLowerCase(languageTag) + name.slice(1) : name

/** One game of a team as a sentence: "Game 3, round 12, beat ME, 17:50". */
export function gameWords(
  { game, other, won }: TeamGame,
  view: CompetitionView,
  text: Say,
  languageTag: string,
): string {
  const rival = other?.teamId ? namesOf(view, text).team(other.teamId) : text("đối thủ chưa rõ", "an unknown team")
  // A label may end in the number its match has within the round, which a sentence has no use for.
  const round = game.entry && matchRound(game.entry, languageTag)?.split(", ")[0]
  const result =
    won == null
      ? text(`gặp ${rival}`, `against ${rival}`)
      : won
        ? text(`thắng ${rival}`, `beat ${rival}`)
        : text(`thua ${rival}`, `lost to ${rival}`)
  const words = [
    game.number > 0 && text(`ván ${game.number}`, `game ${game.number}`),
    round && inSentence(round, languageTag),
    result,
    game.seconds && clock(game.seconds),
  ]
  return capital(words.filter(Boolean).join(", "))
}

/** A hero of a team with the matches it was picked in, which say more than games: a team takes it once in a match. */
export type ClubHero = HeroMate & { matches: number }

/** The heroes of a team, the one picked in most matches first. */
export const clubHeroes = (record: Games): ClubHero[] =>
  teamHeroes(record)
    .map((mate) => ({ ...mate, matches: matchesWith(mate) }))
    .sort((x, y) => y.matches - x.matches || y.games.length - x.games.length)

/** `whole` while the team played the hero in no other lane, so that its games need no lane to be found by. */
export type LaneHero = ClubHero & { whole: boolean }
export type LanePicks = { lane: Lane | null; heroes: LaneHero[] }

const inLane = ({ games }: Games, lane: Lane | null): Games => ({
  games: games.map((game) => ({
    ...game,
    side: { ...game.side, picks: game.side.picks.filter((pick) => pick.lane === lane) },
  })),
})

/** What a team picked for each lane, the usual heroes first; picks nobody recorded a lane for come last. */
export function lanePicks(record: Games): LanePicks[] {
  const whole = new Map(clubHeroes(record).map(({ hero, games }) => [hero.key, games.length]))
  return [...LANES, null]
    .map((lane) => ({
      lane,
      heroes: clubHeroes(inLane(record, lane)).map((mate) => ({
        ...mate,
        whole: whole.get(mate.hero.key) === mate.games.length,
      })),
    }))
    .filter(({ heroes }) => heroes.length > 0)
}

/** How much more often than elsewhere a ban is made before it tells anything: three games in a hundred. */
const TELLING = 0.03

/**
 * The bans a team makes more than the others do, or meets more than the others do: as many as asked of those that exceed
 * the rest of the competition most, the one made most often first. What everybody bans would stand in every list.
 */
export const clubBans = (
  feed: Pick<GameFeed, "games">,
  record: TeamRecord,
  whose: "own" | "against",
  size: number,
): BanHabit[] =>
  banHabits(feed, record.teamId, whose)
    .filter(({ games, share, elsewhere }) => share - elsewhere >= TELLING && games >= enoughForTeam(shownGames(record)))
    .slice(0, size)
    .sort((x, y) => y.games - x.games)

/** What a team won and lost in games of each length a reader asks about. */
export const lengthRows = (games: FeedGame[], team: string): (Tally & (typeof LENGTHS)[number])[] =>
  LENGTHS.map((length) => ({
    ...length,
    ...foundTally(findGames(games, { ...NOTHING_ASKED, team, min: length.min, max: length.max })),
  }))

/** The players of a team by lane; those whose lane nobody recorded come last. */
export function poolLanes(pools: PlayerPool[]): { lane: Lane | null; pools: PlayerPool[] }[] {
  return [...LANES, null]
    .map((lane) => ({ lane, pools: pools.filter((pool) => pool.lane === lane) }))
    .filter((group) => group.pools.length > 0)
}
