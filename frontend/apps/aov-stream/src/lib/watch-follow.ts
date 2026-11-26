import { toStory } from "./watch-place.ts"
import { LEADS, rowsOf, turnStart } from "./watch-rows.ts"
import { lastOf, leadIn } from "./watch-story.ts"
import {
  timed,
  type Chapter,
  type Cut,
  type Cuts,
  type Piece,
  type Story,
  type TimedChapter,
  type WatchCount,
  type WatchLength,
  type WatchTarget,
} from "./watch-types.ts"

/** Whether the video came from one second to the other by playing, at its speed, and not by a seek. */
export function played(before: number, after: number, rate: number): boolean {
  return after > before && after - before <= 2.5 * Math.max(1, rate)
}

const followsOn = (piece: Piece, next: Piece) => next.video === piece.video && next.from - piece.to <= 1

/**
 * What a length asks for after the video has played from `before` to `after`: go on to another piece, stop, or nothing.
 * `stay` is the end of the piece the viewer chose to watch past.
 */
export function stepOf(
  cut: Cut | null,
  length: WatchLength,
  video: string,
  before: number,
  after: number,
  rate: number,
  stay: number | null,
): { kind: "GO"; video: string; second: number } | { kind: "PAUSE" } | null {
  if (!cut || length === "all" || !played(before, after, rate)) return null
  const index = cut.pieces.findIndex(
    (piece) => piece.video === video && before >= piece.from - 1 && before < piece.to && after >= piece.to,
  )
  if (index < 0) return null
  const [piece, next] = cut.pieces.slice(index, index + 2)
  if (piece.hold || piece.to === stay) return null
  if (next) return followsOn(piece, next) ? null : { kind: "GO", video: next.video, second: next.from }
  return length === "quick" ? { kind: "PAUSE" } : null
}

/** The count before a piece ends and another begins, in whole seconds at the speed the video runs. */
export function countAt(
  cut: Cut | null,
  length: WatchLength,
  video: string,
  second: number,
  rate: number,
  stay: number | null,
): WatchCount | null {
  if (!cut || length === "all") return null
  const index = cut.pieces.findIndex(
    ({ video: own, lead, to }) => own === video && lead > 0 && second >= to - lead && second < to,
  )
  if (index < 0) return null
  const [piece, next] = cut.pieces.slice(index, index + 2)
  if (!next || piece.hold || piece.to === stay || followsOn(piece, next)) return null
  return { seconds: Math.ceil((piece.to - second) / rate), of: piece.lead, until: piece.to, next }
}

export type Stop = WatchTarget & { chapter: number }

/** Two stops of a game closer than this are one. */
const APART = 3

function clockStops(chapter: TimedChapter, length: WatchLength) {
  const { draftStart, zero, end, turns } = chapter
  const seconds: number[] = []
  if (draftStart != null && length !== "games") {
    seconds.push(leadIn(draftStart))
    turns.forEach((turn, index) => {
      if (turn.second != null && turn.second !== turns[index - 1]?.second) seconds.push(turnStart(chapter, turn)!)
    })
  }
  seconds.push(leadIn(zero))
  for (const { second } of rowsOf(chapter)) if (second != null) seconds.push(second)
  seconds.push(Math.max(zero, end - LEADS.END))
  return seconds
}

/** The places the steps go through, in the order of the video within each game. */
export function stopsOf(story: Story, cuts: Cuts, length: WatchLength): Stop[] {
  if (length === "quick") return cuts.quick.pieces.map(({ video, from, chapter }) => ({ video, second: from, chapter }))
  return story.chapters.flatMap((chapter) => {
    const seconds = timed(chapter) ? clockStops(chapter, length) : chapter.timing === "LINK" ? [chapter.from!] : []
    return seconds
      .sort((a, b) => a - b)
      .filter((second, index, all) => !index || second - all[index - 1] >= APART)
      .map((second) => ({ video: chapter.video!, second, chapter: chapter.index }))
  })
}

/** The stop before or after a place: going back passes the one that began less than 4 s ago. */
export function stopFrom(stops: Stop[], story: Story, video: string, second: number, way: 1 | -1): Stop | null {
  const now = toStory(story, video, second).chapter?.index ?? -1
  /** Seconds from the place; a stop of another video is far, on the side its game is. */
  const away = (stop: Stop) => {
    if (stop.video === video) return stop.second - second
    return stop.chapter > now ? Infinity : -Infinity
  }
  const stop = way > 0 ? stops.find((other) => away(other) > 2) : lastOf(stops, (other) => away(other) < -4)
  return stop ?? null
}

/** Where a game begins in a length; one without a time where the stretch begins that holds it. */
export function startOf(chapter: Chapter, cuts: Cuts, length: WatchLength): number | null {
  const pieces = length === "quick" || length === "games" ? cuts[length].pieces : []
  const first = timed(chapter) ? pieces.find((piece) => piece.chapter === chapter.index) : null
  return first?.from ?? chapter.from ?? chapter.span?.from ?? null
}

/** A stretch with an untimed game is entered at most this long before its end: a video may begin with another match. */
const SPAN_REACH = 3600

/** Where a match begins in a length, or null where there is nothing to play. */
export function firstOf(story: Story, cuts: Cuts, length: WatchLength): WatchTarget | null {
  const short = length === "quick" || length === "games"
  if (story.level === "PLAIN") {
    const chapter = story.chapters.find(({ video }) => video)
    return { video: chapter?.video ?? story.videos[0], second: chapter?.link ?? 0 }
  }
  const [first] = story.chapters
  if (first?.span && !short) {
    const { from, to } = first.span
    return { video: first.video!, second: to == null ? from : Math.max(from, to - SPAN_REACH) }
  }
  const piece = short ? cuts[length].pieces[0] : null
  if (piece) return { video: piece.video, second: piece.from }
  const chapter = story.chapters.find(({ parts }) => parts.length > 0)
  return chapter ? { video: chapter.video!, second: chapter.from! } : null
}
