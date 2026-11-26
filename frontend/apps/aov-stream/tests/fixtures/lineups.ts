import type { CompetitionLineups, CompetitionView, Lane, LineupTeam, Side } from "@aov/community-contracts"
import { gameFeed, type GameFeed } from "../../src/lib/game-feed.ts"
import { competition, on, stage, type TestMatch } from "./competition.ts"

/** One side of a test game: heroes by name, the picks in lane order. */
export type TestSide = { team: string; picks: string[]; bans?: string[]; players?: (string | null)[] }
/** A game of a test competition; its match is the one whose `seriesId` is `series`. */
export type TestGame = {
  id: string
  series: string
  number?: number
  winner?: Side | null
  seconds?: number
  mvp?: string
  blue: TestSide
  red: TestSide
  /** The draft in order: "BB" is a ban of blue, "RP" a pick of red; heroes are taken in the order listed. */
  draft?: string[]
}

const LANES: Lane[] = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"]

export function lineups(games: TestGame[]): CompetitionLineups {
  const heroes: string[] = []
  const players: string[] = []
  const place = (list: string[], name: string) => {
    if (!list.includes(name)) list.push(name)
    return list.indexOf(name)
  }
  const side = (game: TestGame, code: Side): LineupTeam => {
    const { team, picks, bans = [], players: seats = [] } = code === "BLUE" ? game.blue : game.red
    const turns = (kind: "B" | "P") =>
      (game.draft ?? []).flatMap((turn, index) => (turn === code[0]! + kind ? index + 1 : []))
    const [banTurns, pickTurns] = [turns("B"), turns("P")]
    return {
      teamId: team,
      picks: picks.map((hero, index) => ({
        hero: place(heroes, hero),
        lane: LANES[index]!,
        player: seats[index] ? place(players, seats[index]) : null,
        turn: pickTurns[index] ?? null,
      })),
      bans: bans.map((hero, index) => ({ hero: place(heroes, hero), turn: banTurns[index] ?? null })),
    }
  }
  const listed = games.map((game) => ({
    id: game.id,
    seriesId: game.series,
    number: game.number ?? 1,
    winner: game.winner === undefined ? ("BLUE" as Side) : game.winner,
    seconds: game.seconds ?? null,
    mvp: game.mvp ? place(players, game.mvp) : null,
    blue: side(game, "BLUE"),
    red: side(game, "RED"),
  }))
  return {
    heroes: heroes.map((name) => ({ id: `id-${name}`, code: name, name: name.toUpperCase(), iconUrl: null })),
    players: players.map((id) => ({ id, name: id })),
    games: listed,
  }
}

/** A round robin of three teams, one match a day. */
export const roundRobin: TestMatch[] = [
  { key: "m1", seriesId: "s1", a: "x", b: "y", score: [2, 0], scheduledAt: on(1) },
  { key: "m2", seriesId: "s2", a: "y", b: "z", score: [2, 1], scheduledAt: on(2) },
  { key: "m3", seriesId: "s3", a: "z", b: "x", score: [0, 2], scheduledAt: on(9) },
]

export const roundRobinView = (
  matches: TestMatch[] = roundRobin,
  { stages = [stage("RR", { format: "ROUND_ROBIN", winPoints: 1, lossPoints: 0 })] } = {},
): CompetitionView => competition(matches, { stages })

/** Two stages that follow each other: the games of "s1" are of a round robin, those of "s2" of the knockout after it. */
export const twoStages = (): CompetitionView =>
  competition(
    [
      { key: "m1", seriesId: "s1", a: "x", b: "y", scheduledAt: on(1) },
      { key: "m2", seriesId: "s2", a: "x", b: "y", scheduledAt: on(20), stageCode: "KO" },
    ],
    { stages: [stage("RR", { format: "ROUND_ROBIN" }), stage("KO")] },
  )

/** The feed of some games; the players they name become players of the competition. */
export function feedOf(games: TestGame[], view: CompetitionView = roundRobinView()): GameFeed {
  const answer = lineups(games)
  const named = Object.fromEntries(answer.players.map(({ id }) => [id, { code: id, nickname: id }]))
  return gameFeed({ ...view, content: { ...view.content, players: named } } as CompetitionView, answer)
}

/** Five heroes of one letter: "a" gives a1 to a5. */
export const five = (letter: string) => [1, 2, 3, 4, 5].map((index) => letter + index)
