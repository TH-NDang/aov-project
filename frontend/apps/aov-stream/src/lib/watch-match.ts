import type { PublishedGame, SeriesContent } from "@aov/community-contracts"
import { currentTimeZone, dayKeyInZone, isValidTimeZone } from "@aov/ui/lib/time-zone"
import { competitionMatchHref, matchState, type CompetitionMatch } from "./match-model.ts"
import { matchSides, type MatchSide } from "./match-schedule.ts"
import { scoreAfter } from "./watch-place.ts"
import type { Score, Story } from "./watch-types.ts"

export type RoomSide = { name: string; logoUrl?: string | null; logoDarkUrl?: string | null }

/** The match after this one in its competition, as the end of a video offers it. */
export type RoomNext = {
  href: string
  a: RoomSide
  b: RoomSide
  at: string | null
  /** The zone its competition is planned in. */
  zone: string | undefined
  bestOf: number
  /** Played on the same calendar day of the competition. */
  sameDay: boolean
  watchable: boolean
}

type HeadScore = { teamId?: string | null; score: number | null }

/** The result that the head of a match tells, with the team called `first` as the first of the video. */
export function recordedScore([a, b]: [HeadScore, HeadScore], first: string | null | undefined): Score | null {
  if (a.score == null || b.score == null) return null
  return first && b.teamId === first ? { A: b.score, B: a.score } : { A: a.score, B: b.score }
}

/**
 * What each team had won before the first game that is published. The recorded result tells it where exactly the games
 * before that one are missing; otherwise the score counts the games that are there, from 0–0.
 */
export function scoreBefore(story: Story, recorded: Score | null): Score {
  const none: Score = { A: 0, B: 0 }
  const [first] = story.chapters
  if (!first || !recorded) return none
  const won = scoreAfter({ story, before: none }, story.chapters.length)
  const before: Score = { A: recorded.A - won.A, B: recorded.B - won.B }
  const told = before.A >= 0 && before.B >= 0 && before.A + before.B === first.number - 1
  return told ? before : none
}

const roomSide = ({ name, logoUrl, logoDarkUrl }: MatchSide): RoomSide => ({ name, logoUrl, logoDarkUrl })

/** The match that comes after `entry`, with its teams named in `locale`. */
export function roomNext(
  entry: CompetitionMatch,
  after: CompetitionMatch,
  watchable: boolean,
  locale: string,
): RoomNext {
  const { timezone } = after.competition.content.plan
  const zone = isValidTimeZone(timezone) ? timezone : undefined
  const day = ({ match }: CompetitionMatch) => dayKeyInZone(match.scheduledAt, zone ?? currentTimeZone())
  const [a, b] = matchSides(after, locale)
  return {
    href: competitionMatchHref(after.competition.id, after.match.key),
    a: roomSide(a),
    b: roomSide(b),
    at: after.match.scheduledAt || null,
    zone,
    bestOf: after.match.bestOf,
    sameDay: !!day(after) && day(after) === day(entry),
    watchable,
  }
}

/** Whether a match has begun, so that its link leads to a video and not to one that is announced. */
export function matchBegun(entry: CompetitionMatch | undefined, games: PublishedGame[], now: number) {
  if (games.length || !entry) return true
  const state = matchState(entry, now)
  return state !== "UPCOMING" && state !== "UNSCHEDULED"
}

/** Whether the recorded result of a match is its last one: a team has won it, or every game of it was played. */
export function matchOver(entry: CompetitionMatch | undefined, series: SeriesContent | undefined) {
  const result = entry ? entry.result : series?.result
  const bestOf = entry ? entry.match.bestOf : series?.bestOf
  const [a, b] = [result?.scoreA, result?.scoreB]
  if (a == null || b == null || !bestOf) return false
  return Math.max(a, b) > bestOf / 2 || a + b >= bestOf
}
