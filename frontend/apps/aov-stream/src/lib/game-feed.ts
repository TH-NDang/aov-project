import type {
  CompetitionLineups,
  CompetitionStage,
  CompetitionView,
  Lane,
  LineupPlayer,
  LineupTeam,
  Side,
  StagePatch,
} from "@aov/community-contracts"
import { dayKeyInZone } from "@aov/ui/lib/time-zone"
import { playedOrder } from "./competition-model.ts"
import { competitionMatches, matchSeriesId, planZone, type CompetitionMatch } from "./match-model.ts"
import { labelWeeks, playWeeks } from "./play-weeks.ts"

/** `key` is what an address calls the hero: its code, or its name while the games know it by that alone. */
export type FeedHero = { key: string; id: string | null; code: string | null; name: string; iconUrl: string | null }
/** `turn` counts all turns of a draft whose order is known. */
export type FeedPick = { hero: FeedHero; lane: Lane | null; playerId: string | null; turn: number | null }
export type FeedBan = { hero: FeedHero; turn: number | null }
export type FeedSide = { side: Side; teamId: string | null; picks: FeedPick[]; bans: FeedBan[] }
export type FeedGame = {
  id: string
  seriesId: string
  number: number
  /** The match it was played in, while the plan names it. */
  entry: CompetitionMatch | null
  /** When its match started, 0 while nobody knows. */
  at: number
  /** yyyy-mm-dd on the calendar where the event is played. */
  day: string | null
  stage: string | null
  /** The week of its stage, counted from 1. */
  week: number | null
  /** The patch line of its stage, counted from 1. */
  patch: number | null
  winner: Side | null
  seconds: number | null
  mvpId: string | null
  /** Blue before red. */
  sides: FeedSide[]
}
/** A part of a competition to count alone: a stage, or the games of a stage under one of its patches. */
export type FeedPeriod = {
  /** The stage's code; with the patch's number after a dot for a part of it ("GROUP.2"). */
  key: string
  stage: CompetitionStage
  patch: StagePatch | null
  games: number
}
export type GameFeed = {
  /** The competition, with every player its games name. */
  view: CompetitionView
  heroes: FeedHero[]
  /** The game played last comes first. */
  games: FeedGame[]
  /** The stages in the order they are played, each followed by its patches where they can be told apart. */
  periods: FeedPeriod[]
}

function feedSide(
  side: Side,
  team: LineupTeam | null | undefined,
  heroes: FeedHero[],
  players: LineupPlayer[],
): FeedSide | null {
  if (!team) return null
  return {
    side,
    teamId: team.teamId ?? null,
    picks: team.picks.map(({ hero, lane, player, turn }) => ({
      hero: heroes[hero]!,
      lane: lane ?? null,
      playerId: player == null ? null : (players[player]?.id ?? null),
      turn: turn ?? null,
    })),
    bans: team.bans.map(({ hero, turn }) => ({ hero: heroes[hero]!, turn: turn ?? null })),
  }
}

/**
 * The patch line of a stage a match day falls under, counted from 1. The weeks the labels name decide, because an event
 * may take up a patch some days after its release; without them the line released last by that day does.
 */
export function patchLine(patches: StagePatch[], day: string | null, week: number | null): number | null {
  if (!patches.length) return null
  if (patches.length === 1 && !patches[0]!.releasedOn) return 1
  const weeks = patches.map((patch) => labelWeeks(patch.label))
  if (week != null && weeks.every((range) => range)) {
    const at = weeks.findIndex((range) => week >= range![0] && week <= range![1])
    return at < 0 ? null : at + 1
  }
  if (!day) return null
  const released = patches
    .map((patch, index) => ({ on: patch.releasedOn, line: index + 1 }))
    .filter(({ on }) => on && on <= day)
    .sort((x, y) => (x.on! < y.on! ? 1 : -1))
  return released[0]?.line ?? null
}

/** A competition that knows every player of its games: a roster does not name everybody who played. */
function withPlayers(view: CompetitionView, players: LineupPlayer[]): CompetitionView {
  const known = view.content.players
  const missing = players.flatMap(({ id, name }) => (name && !known[id] ? [[id, { code: id, nickname: name }]] : []))
  if (!missing.length) return view
  return { ...view, content: { ...view.content, players: { ...Object.fromEntries(missing), ...known } } }
}

/** Whether a game shows who was banned: one without a single ban is one whose bans nobody wrote down. */
export const showsBans = (game: Pick<FeedGame, "sides">) => game.sides.some((side) => side.bans.length > 0)

/** How many games are counted, and how many of them show their bans: how often a hero was banned is out of those. */
export type Counted = { games: number; shown: number }

export const countGames = (games: Pick<FeedGame, "sides">[]): Counted => ({
  games: games.length,
  shown: games.filter(showsBans).length,
})

/** The published games of a competition with the match, the stage and the day each was played on. */
export function gameFeed(view: CompetitionView, lineups: CompetitionLineups): GameFeed {
  const { plan } = view.content
  const zone = planZone(plan)
  const heroes = lineups.heroes.map(({ id, code, name, iconUrl }): FeedHero => ({
    key: code || id || name,
    id: id ?? null,
    code: code ?? null,
    name,
    iconUrl: iconUrl ?? null,
  }))
  const entries = new Map(
    competitionMatches([view]).flatMap((entry) => {
      const series = matchSeriesId(entry)
      return series ? [[series, entry] as const] : []
    }),
  )
  const stages = new Map(plan.stages.map((stage) => [stage.code, stage]))
  const games = lineups.games.map((game): FeedGame => {
    const entry = entries.get(game.seriesId) ?? null
    const at = Date.parse(entry?.match.scheduledAt || "") || 0
    return {
      id: game.id,
      seriesId: game.seriesId,
      number: game.number ?? 0,
      entry,
      at,
      day: at ? dayKeyInZone(at, zone) : null,
      stage: entry?.match.stageCode ?? null,
      week: null,
      patch: null,
      winner: game.winner ?? null,
      seconds: game.seconds ?? null,
      mvpId: game.mvp == null ? null : (lineups.players[game.mvp]?.id ?? null),
      sides: [
        feedSide("BLUE", game.blue, heroes, lineups.players),
        feedSide("RED", game.red, heroes, lineups.players),
      ].filter((side) => side != null),
    }
  })
  for (const [code, stage] of stages) {
    const own = games.filter((game) => game.stage === code)
    const weeks = playWeeks(own.flatMap((game) => game.day ?? []))
    for (const game of own) {
      game.week = game.day ? (weeks.get(game.day) ?? null) : null
      game.patch = patchLine(stage.patches ?? [], game.day, game.week)
    }
  }
  // Matches that start together, as two finals of one evening may, follow the plan: the later one was played later.
  const planned = new Map(plan.matches.map((match, index) => [match.key, index]))
  const round = ({ entry }: FeedGame) => entry?.match.round ?? 0
  const place = ({ entry }: FeedGame) => (entry ? (planned.get(entry.match.key) ?? -1) : -1)
  games.sort(
    (x, y) =>
      y.at - x.at ||
      round(y) - round(x) ||
      place(y) - place(x) ||
      x.seriesId.localeCompare(y.seriesId) ||
      y.number - x.number,
  )
  return { view: withPlayers(view, lineups.players), heroes, games, periods: periodsOf(view, games) }
}

function periodsOf(view: CompetitionView, games: FeedGame[]): FeedPeriod[] {
  const { plan } = view.content
  return playedOrder(plan.stages, plan.matches).flatMap((stage): FeedPeriod[] => {
    const own = games.filter((game) => game.stage === stage.code)
    if (!own.length) return []
    const parts = (stage.patches ?? []).flatMap((patch, index): FeedPeriod[] => {
      const under = own.filter((game) => game.patch === index + 1).length
      return under ? [{ key: `${stage.code}.${index + 1}`, stage, patch, games: under }] : []
    })
    return [{ key: stage.code, stage, patch: null, games: own.length }, ...(parts.length > 1 ? parts : [])]
  })
}

/** The games of one period; the whole feed while the address names none of its periods. */
export function feedScope(feed: GameFeed, key: string | null): { feed: GameFeed; period: FeedPeriod | null } {
  const period = feed.periods.find((item) => item.key === key) ?? null
  if (!period) return { feed, period }
  const patch = period.patch ? Number(period.key.slice(period.stage.code.length + 1)) : null
  const games = feed.games.filter((game) => game.stage === period.stage.code && (patch == null || game.patch === patch))
  return { feed: { ...feed, games }, period }
}

/** The side a game was won by, the side that lost it, or null while its winner is not recorded. */
export const wonBy = (game: FeedGame, side: FeedSide): boolean | null =>
  game.winner == null ? null : game.winner === side.side

/** The other side of a game. */
export const facing = (game: FeedGame, side: FeedSide): FeedSide | null =>
  game.sides.find((other) => other !== side) ?? null

/** The side a team played a game on. */
export const sideOf = (game: FeedGame, teamId: string): FeedSide | null =>
  game.sides.find((side) => side.teamId === teamId) ?? null

/** The average length of games in seconds, or null while none is known. */
export function averageSeconds(games: Pick<FeedGame, "seconds">[]): number | null {
  const lengths = games.flatMap((game) => game.seconds || [])
  return lengths.length ? Math.round(lengths.reduce((sum, value) => sum + value, 0) / lengths.length) : null
}

/** A hero the address names by its code, its id or its name. */
export const heroByKey = (feed: Pick<GameFeed, "heroes">, key: string | null | undefined): FeedHero | null =>
  (key && feed.heroes.find((hero) => hero.key === key || hero.id === key || hero.name === key)) || null
