import type { CompetitionView } from "@aov/community-contracts"
import { matchUnderway, matchWinner } from "./competition-model.ts"
import { findGames, NOTHING_ASKED } from "./finder-model.ts"
import { sideOf, wonBy, type FeedGame, type GameFeed } from "./game-feed.ts"
import { competitionMatches, matchSeriesId, matchState, type CompetitionMatch } from "./match-model.ts"
import { labelStep, type StepKind } from "./standings-steps.ts"

/** One match between two teams, seen from one of them. */
export type Meeting = {
  entry: CompetitionMatch
  opponentId: string
  /** Games won and lost; null while the match has no score. */
  own: number | null
  rival: number | null
  won: boolean | null
  /** Each game in order, won or lost, null while nobody knows; empty while none of its games is published. */
  marks: (boolean | null)[]
}

/** The meetings of each team, the first played coming first. */
export type Meetings = Map<string, Meeting[]>

const teamsOf = ({ match, result }: CompetitionMatch) => ({
  a: result?.teamAId || match.a.teamId || null,
  b: result?.teamBId || match.b.teamId || null,
})

/** The first played comes first; a match without a date is still to be placed, so it follows those that have one. */
function inOrder(x: CompetitionMatch, y: CompetitionMatch) {
  const [first, second] = [x, y].map(({ match }) => Date.parse(match.scheduledAt || "") || Infinity)
  return first === second ? x.match.round - y.match.round : first! - second!
}

/**
 * The games of a match in the order they were played, seen from a team. A game the score counts but nobody published is
 * unknown; it stands where its number puts it, or last where the games are not numbered.
 */
function marksOf(games: FeedGame[], teamId: string, counted: number): (boolean | null)[] {
  if (!games.length) return []
  const results = games
    .map((game) => {
      const side = sideOf(game, teamId)
      return { number: game.number, won: side ? wonBy(game, side) : null }
    })
    .sort((x, y) => x.number - y.number)
  const length = Math.max(counted, results.length)
  const numbered = results.every(
    ({ number }, index) => number >= 1 && number <= length && number !== results[index - 1]?.number,
  )
  const marks = Array.from({ length }, (): boolean | null => null)
  results.forEach(({ number, won }, index) => (marks[numbered ? number - 1 : index] = won))
  return marks
}

/** Every match of a stage between known teams, seen from each of the two, the first played coming first. */
export function stageMeetings(view: CompetitionView, stageCode: string, feed: GameFeed | null): Meetings {
  const games = new Map<string, FeedGame[]>()
  for (const game of feed?.games ?? []) games.set(game.seriesId, [...(games.get(game.seriesId) ?? []), game])
  const meetings: Meetings = new Map()
  const entries = competitionMatches([view])
    .filter((entry) => entry.match.stageCode === stageCode)
    .sort(inOrder)
  for (const entry of entries) {
    const { a, b } = teamsOf(entry)
    if (!a || !b) continue
    const { scoreA, scoreB } = entry.result ?? {}
    const winner = matchWinner(entry)
    const published = games.get(matchSeriesId(entry) ?? "") ?? []
    for (const [team, opponentId, own, rival, side] of [
      [a, b, scoreA, scoreB, "a"],
      [b, a, scoreB, scoreA, "b"],
    ] as const)
      meetings.set(team, [
        ...(meetings.get(team) ?? []),
        {
          entry,
          opponentId,
          own: own ?? null,
          rival: rival ?? null,
          won: winner == null ? null : winner === side,
          marks: marksOf(published, team, (own ?? 0) + (rival ?? 0)),
        },
      ])
  }
  return meetings
}

/** The meetings of two teams, seen from the first. */
export const meetingsBetween = (meetings: Meetings, teamId: string, opponentId: string): Meeting[] =>
  (meetings.get(teamId) ?? []).filter((meeting) => meeting.opponentId === opponentId)

/** The games of several meetings added up. */
export const meetingScore = (meetings: Meeting[]) => ({
  own: meetings.reduce((sum, { own }) => sum + (own ?? 0), 0),
  rival: meetings.reduce((sum, { rival }) => sum + (rival ?? 0), 0),
  played: meetings.filter(({ own }) => own != null).length,
})

/** How a score reads from one side. A match nobody has won is level, whether it is drawn or still being played. */
export type Outcome = "won" | "lost" | "level"

export function meetingOutcome({ own, rival, won }: Pick<Meeting, "own" | "rival" | "won">): Outcome | null {
  if (own == null || rival == null) return null
  return won == null ? "level" : won ? "won" : "lost"
}

/** Whether a match without a score should have been played by now. */
export const isOverdue = ({ entry }: Pick<Meeting, "entry">, now: number): boolean =>
  matchState(entry, now) === "PENDING" && !matchUnderway(entry, now)

export const sumOutcome = ({ own, rival }: { own: number; rival: number }): Outcome =>
  own === rival ? "level" : own > rival ? "won" : "lost"

/** The games of several meetings as marks: those won, then those lost. */
export const sumMarks = ({ own, rival }: { own: number; rival: number }): boolean[] => [
  ...Array<boolean>(own).fill(true),
  ...Array<boolean>(rival).fill(false),
]

/**
 * How many published games two teams played against each other, in the whole competition and in one of its stages. They
 * are counted the way the finder finds them, so the number is the one it shows.
 */
export function gamesOfPair(feed: GameFeed | null, team: string, opp: string, stage: string | null) {
  const found = feed ? findGames(feed.games, { ...NOTHING_ASKED, team, opp }) : []
  return { every: found.length, here: found.filter(({ game }) => game.stage === stage).length }
}

/** The share of pairs that have to meet for a table of every pair to say more than its empty cells. */
const DENSE = 0.6

/**
 * Whether most of the teams of a group meet each other. A meeting counts from the day it is planned, so a round robin
 * under way is a table of every pair from its first match. `open` are matches planned between teams nobody knows yet,
 * each of which may still bring two together.
 */
export function meetEveryone(teams: string[], meetings: Meetings, open = 0): boolean {
  if (teams.length < 3) return false
  const met = teams.map((team) => new Set((meetings.get(team) ?? []).map(({ opponentId }) => opponentId)))
  const pairs = teams.reduce(
    (sum, _, index) => sum + teams.slice(0, index).filter((team) => met[index]!.has(team)).length,
    0,
  )
  return pairs + open >= DENSE * ((teams.length * (teams.length - 1)) / 2)
}

/**
 * Matches of a stage planned between teams nobody knows yet. Where several groups share a stage nothing says whose match
 * an open one is, so it counts for none of them.
 */
export function openMatches(view: CompetitionView, stageCode: string, teams: string[], meetings: Meetings): number {
  if ([...meetings.keys()].some((team) => !teams.includes(team))) return 0
  return competitionMatches([view]).filter((entry) => {
    const { a, b } = teamsOf(entry)
    return entry.match.stageCode === stageCode && (!a || !b)
  }).length
}

/** How many matches each pair of a group that meets plays against each other. */
const pairLegs = (teams: string[], meetings: Meetings): number[] =>
  teams
    .flatMap((team, index) => teams.slice(0, index).map((other) => meetingsBetween(meetings, team, other).length))
    .filter((legs) => legs > 0)

/** The most matches any two teams of a group play against each other. */
export const mostLegs = (teams: string[], meetings: Meetings): number => Math.max(0, ...pairLegs(teams, meetings))

/** The matches a pair of a group usually plays, whatever a tie-break adds for some of them. */
export function usualLegs(teams: string[], meetings: Meetings): number {
  const counts = new Map<number, number>()
  for (const legs of pairLegs(teams, meetings)) counts.set(legs, (counts.get(legs) ?? 0) + 1)
  return [...counts].sort(([x, few], [y, many]) => many - few || y - x)[0]?.[0] ?? 0
}

/** The most games any match of a group took, as its score or its published games count them. */
export const mostGames = (teams: string[], meetings: Meetings): number =>
  Math.max(
    0,
    ...teams.flatMap((team) =>
      (meetings.get(team) ?? []).map(({ own, rival, marks }) => Math.max(marks.length, (own ?? 0) + (rival ?? 0))),
    ),
  )

/** A column of the ways of the teams. `kind` says what the plan calls it; without one it is only counted. */
export type MeetingRound = { number: number; kind: StepKind | null; of: Map<string, Meeting> }

/**
 * The matches of each team side by side, one column a round: the rounds, weeks or days the labels name, or else the
 * rounds of the plan, as long as no team plays twice in one; otherwise the first match of each team, its second, and so
 * on.
 */
export function meetingRounds(teams: string[], meetings: Meetings): MeetingRound[] {
  const lists = teams.map((team) => [team, meetings.get(team) ?? []] as const)
  const steps = lists.flatMap(([, list]) => list.map(({ entry }) => labelStep(entry.match.label)))
  const kind = steps[0] && steps.every((step) => step?.kind === steps[0]!.kind) ? steps[0].kind : null
  const named = ({ entry }: Meeting) => labelStep(entry.match.label)!.number
  const planned = ({ entry }: Meeting) => entry.match.round
  const once = (number: (meeting: Meeting) => number) =>
    lists.every(([, list]) => new Set(list.map(number)).size === list.length)
  const number = kind && once(named) ? named : once(planned) ? planned : null
  const rounds = new Map<number, MeetingRound>()
  for (const [team, list] of lists)
    list.forEach((meeting, index) => {
      const at = number ? number(meeting) : index + 1
      const round = rounds.get(at) ?? { number: at, kind: number === named ? kind : null, of: new Map() }
      round.of.set(team, meeting)
      rounds.set(at, round)
    })
  return [...rounds.values()].sort((x, y) => x.number - y.number)
}
