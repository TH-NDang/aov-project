import type { PublishedGame, Selection } from "@aov/community-contracts"
import { gameToVideo, videoToGame } from "@aov/ui/lib/game-video"
import { present } from "./tournament-model.ts"
import { lastOf, WATCH } from "./watch-story.ts"
import {
  timed,
  type Chapter,
  type MomentKind,
  type Place,
  type Score,
  type Story,
  type StoryPart,
  type TimedChapter,
  type WatchMatch,
  type WatchTeam,
  type WatchTurn,
} from "./watch-types.ts"

/** The pause of the broadcast a second of the video lies in, as seconds of the video. */
function pauseAt(chapter: TimedChapter, second: number) {
  for (const pause of chapter.pauses) {
    const from = gameToVideo(chapter.zero, chapter.pauses, pause.atSeconds)
    const to = from + pause.durationSeconds
    if (second > from && second < to) return { from, to }
  }
  return null
}

function placeInGame(chapter: TimedChapter, next: Chapter | null, second: number): Place | null {
  const left = chapter.zero - second
  if (chapter.draftStart != null && second < (chapter.lock ?? chapter.zero))
    return { state: "DRAFT", chapter, next, clock: null, left, over: false }
  if (second < chapter.zero) return { state: "WAIT", chapter, next, clock: null, left, over: false }
  if (second >= chapter.end + WATCH.tell) return null
  const clock = Math.min(chapter.length, videoToGame(chapter.zero, chapter.pauses, second))
  const pause = pauseAt(chapter, second)
  return pause
    ? { state: "PAUSE", chapter, next, clock, left: pause.to - second, over: false }
    : { state: "PLAY", chapter, next, clock, left: null, over: false }
}

/** Where a game begins for someone who waits for it: its draft, or else its 0:00 or the second its link names. */
const opening = (chapter: Chapter) => chapter.draftStart ?? chapter.zero ?? chapter.from ?? 0

/** Where a second of a video stands in the match. */
export function placeAt(story: Story, video: string | null, second: number): Place {
  const own = story.chapters.filter((chapter) => chapter.parts.length > 0 && chapter.video === video)
  if (!own.length) return { state: "UNKNOWN", chapter: null, next: null, clock: null, left: null, over: false }

  const span = story.chapters.find(
    (chapter) =>
      chapter.span && chapter.video === video && second >= chapter.span.from && second < (chapter.span.to ?? Infinity),
  )
  if (span) {
    const next = own.find((chapter) => chapter.from! > second) ?? null
    return { state: "SPAN", chapter: span, next, clock: null, left: next && next.from! - second, over: false }
  }

  const chapter = lastOf(own, ({ from }) => second >= from!)
  if (!chapter)
    return { state: "BEFORE", chapter: null, next: own[0], clock: null, left: opening(own[0]) - second, over: false }

  const next = story.chapters.slice(chapter.index + 1).find((later) => later.parts.length > 0) ?? null
  const left = next?.video === video ? opening(next) - second : null
  const rest = chapter.index < story.chapters.length - 1 ? "BREAK" : "AFTER"
  if (timed(chapter))
    return (
      placeInGame(chapter, next, second) ?? { state: rest, chapter, next, clock: chapter.length, left, over: false }
    )

  const end = chapter.end!
  if (next?.video !== video && second >= end - WATCH.linkTail + WATCH.linkOver)
    return { state: rest, chapter, next, clock: null, left, over: false }
  return { state: "GAME", chapter, next, clock: null, left, over: second >= end }
}

/** The second of the story for a second of a video; between two parts it stands at the end of the earlier one. */
export function toStory(
  story: Story,
  video: string,
  second: number,
): { at: number; inside: boolean; chapter: Chapter | null; part: StoryPart | null } {
  let found: ReturnType<typeof toStory> = { at: 0, inside: false, chapter: null, part: null }
  let reached = false
  for (const chapter of story.chapters)
    for (const part of chapter.parts) {
      const end = { at: part.at + part.seconds, inside: false, chapter, part }
      if (chapter.video !== video) {
        if (!reached) found = end
        continue
      }
      if (second < part.from) return found
      if (second < part.to) return { at: part.at + second - part.from, inside: true, chapter, part }
      reached = true
      found = end
    }
  return found
}

/** The video and its second for a second of the story. */
export function toVideo(
  story: Story,
  at: number,
): { video: string; second: number; chapter: Chapter; part: StoryPart } | null {
  let last: ReturnType<typeof toVideo> = null
  for (const chapter of story.chapters)
    for (const part of chapter.parts) {
      const video = chapter.video!
      if (at < part.at + part.seconds) return { video, second: part.from + Math.max(0, at - part.at), chapter, part }
      last = { video, second: part.to, chapter, part }
    }
  return last
}

/** How many games have ended at a place, in the order they were played. */
function endedAt(place: Place | null) {
  if (!place) return 0
  if (place.state === "BEFORE") return place.next?.index ?? 0
  if (!place.chapter) return 0
  return place.chapter.index + (place.state === "BREAK" || place.state === "AFTER" ? 1 : 0)
}

type Scored = Pick<WatchMatch, "story" | "before">

/** How both teams stand after so many of the games that are published. */
export function scoreAfter({ story, before }: Scored, games: number): Score {
  const score = { ...before }
  for (const { winner } of story.chapters.slice(0, games)) if (winner) score[winner] += 1
  return score
}

/** How both teams stand at a place: the games that have ended before it. */
export function scoreAt(match: Scored, place: Place | null): Score {
  return scoreAfter(match, endedAt(place))
}

/** The draft of a game at a second of its video: what has been made, and the turns being decided together. */
export function draftAt(chapter: Chapter, second: number): (WatchTurn & { made: boolean; open: boolean })[] {
  const turns = chapter.turns.map((turn) => ({
    ...turn,
    made: turn.second != null && turn.second <= second,
    open: false,
  }))
  const first = turns.findIndex((turn) => !turn.made)
  for (let index = first; index >= 0 && index < turns.length; index++) {
    const turn = turns[index]
    if (turn.kind !== turns[first].kind || turn.side !== turns[first].side) break
    turn.open = true
  }
  return turns
}

const COUNTED: MomentKind[] = ["KILL", "TURRET", "ABYSSAL_DRAGON", "DARK_SLAYER"]
/** Seconds after the last recorded moment from which the counts may be behind, unless the game ends within them. */
export const SILENT = 90

/** What each team has taken up to a second of the game. `upTo`: the second the records of the game end at. */
export function countsAt(
  chapter: Chapter,
  clock: number,
): {
  kinds: MomentKind[]
  A: Partial<Record<MomentKind, number>>
  B: Partial<Record<MomentKind, number>>
  upTo: number | null
} {
  const last = chapter.moments.at(-1)?.at
  const kinds = COUNTED.filter((kind) => chapter.moments.some((moment) => moment.kind === kind))
  const taken = (team: WatchTeam): Partial<Record<MomentKind, number>> =>
    Object.fromEntries(
      kinds.map((kind) => [
        kind,
        chapter.moments
          .filter((moment) => moment.team === team && moment.kind === kind && moment.at <= clock)
          .reduce((sum, moment) => sum + moment.count, 0),
      ]),
    )
  const silent = last != null && clock > last + SILENT && chapter.length != null && chapter.length - last > SILENT
  return { kinds, A: taken("A"), B: taken("B"), upTo: silent ? last : null }
}

/**
 * The heroes each team played in the earlier games, while it may not pick them again: not in the last possible game. Of
 * a game that is not published nobody can say whom it took, so after one there are none.
 */
export function usedBefore(
  story: Story,
  chapter: Chapter,
): Record<WatchTeam, { hero: Selection; game: PublishedGame }[]> {
  const used: ReturnType<typeof usedBefore> = { A: [], B: [] }
  const free = chapter.game.series.repeatPicksAllowed || (story.bestOf > 1 && chapter.number >= story.bestOf)
  if (free || chapter.index < chapter.number - 1) return used
  for (const { game } of story.chapters.slice(0, chapter.index))
    for (const side of game.content.sides) {
      const heroes = used[side.teamId === story.teams?.[0] ? "A" : "B"]
      for (const { hero } of side.participants) if (present(hero)) heroes.push({ hero, game })
    }
  return used
}

/** Whether the viewer has come far enough into the story to be told who won a game. */
export function told(story: Story, chapter: Chapter, reached: number, done: boolean): boolean {
  if (done) return true
  const part = chapter.parts.at(-1)
  if (part && timed(chapter)) return reached >= part.at + chapter.end + WATCH.tell - part.from
  const next = story.chapters.slice(chapter.index + 1).find((later) => later.parts.length > 0)
  return !!next && reached > next.parts[0].at
}
