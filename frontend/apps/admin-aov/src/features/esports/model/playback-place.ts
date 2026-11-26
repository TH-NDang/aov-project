import { formatClock } from "@/lib/clock"
import { chapterAt, chapterClock, type GameChapter } from "./series-vod"
import type { TimelineEvent } from "./timeline"

/** What the video shows at a second: a phase of one game, or the time between games. */
export type Place =
  | { kind: "draft" | "wait" | "play" | "pause"; chapter: GameChapter; clock: number }
  | { kind: "between"; chapter: null; previous: GameChapter | null; next: GameChapter | null }

const PHASE_WORDS = { draft: "cấm chọn", wait: "chờ vào trận", pause: "tạm dừng" } as const

/** A place inside a game in words: the phase it is in, or its clock while it is played. */
export const phaseWords = (place: Exclude<Place, { kind: "between" }>) =>
  place.kind === "play" ? formatClock(place.clock) : PHASE_WORDS[place.kind]

/** Whether a pause of the broadcast holds the game clock at a video second. */
function paused(chapter: GameChapter, second: number) {
  let resumed = chapter.start
  const pauses = chapter.sync.pauses
    .filter((pause) => pause.durationSeconds > 0 && pause.atSeconds >= 0)
    .sort((a, b) => a.atSeconds - b.atSeconds)
  for (const pause of pauses) {
    const from = resumed + pause.atSeconds
    if (second > from && second < from + pause.durationSeconds) return true
    resumed += pause.durationSeconds
  }
  return false
}

export function placeAt(chapters: GameChapter[], second: number): Place {
  const chapter = chapterAt(chapters, second)
  if (!chapter) {
    const placed = chapters.filter((candidate) => candidate.synced).sort((a, b) => a.from - b.from)
    return {
      kind: "between",
      chapter: null,
      previous: placed.filter((candidate) => candidate.from <= second).at(-1) ?? null,
      next: placed.find((candidate) => candidate.from > second) ?? null,
    }
  }
  const clock = chapterClock(chapter, second)
  if (chapter.live && second >= chapter.start)
    return { kind: paused(chapter, second) ? "pause" : "play", chapter, clock }
  const locked = chapter.draft?.locked
  return { kind: locked != null && second >= locked ? "wait" : "draft", chapter, clock: 0 }
}

/** The end of the step a second falls in, counted from the beginning of its phase. */
const roundUp = (second: number, from: number, step: number) => from + Math.ceil((second - from) / step) * step

/** Video shown on both sides of the playhead outside every game. */
const AROUND = 10 * 60

/**
 * The stretch of video that belongs to a place: the phase itself where both its ends are known, otherwise a stretch
 * that grows in steps while the phase goes on. The key changes only with the game, the phase or such a step, so whoever
 * follows the stretch is not moved by the running second. Null when no game has a place in the video.
 */
export function phaseRange(
  place: Place,
  now: number,
  duration: number,
): { key: string; from: number; to: number } | null {
  if (place.kind === "between") {
    if (!place.previous && !place.next) return null
    const key = `between:${place.previous?.gameId ?? ""}:${place.next?.gameId ?? ""}`
    return { key, from: now - AROUND, to: now + AROUND }
  }
  const { chapter } = place
  const stretch = (phase: string, from: number, to: number) => {
    const end = Math.min(Math.max(to, from), Math.max(duration, from))
    return { key: `${phase}:${chapter.gameId}:${from}:${end}`, from, to: end }
  }
  if (place.kind === "play" || place.kind === "pause")
    return stretch(
      "play",
      chapter.start,
      chapter.ended ? chapter.end : Math.max(chapter.start + 15 * 60, roundUp(now + 60, chapter.start, 5 * 60)),
    )
  const from = chapter.draft?.start ?? chapter.from
  const growing = roundUp(now + 30, from, 2 * 60)
  if (place.kind === "wait") return stretch("wait", from, chapter.live ? chapter.start : growing)
  const known = chapter.draft?.locked ?? (chapter.live ? chapter.start : null)
  return stretch("draft", from, known ?? Math.max(from + 8 * 60, growing))
}

/**
 * Every second worth stopping at, in order: the timed turns, the four edges of each game and the moments, which carry
 * their id. Where a moment shares its second with a turn or an edge, the moment is the stop.
 */
export function markSeconds(
  chapters: GameChapter[],
  events: TimelineEvent[],
): { second: number; eventId: string | null }[] {
  const stops = new Map<number, string | null>()
  for (const chapter of chapters) {
    if (!chapter.synced) continue
    const seconds = [
      chapter.draft?.start,
      ...(chapter.draft?.turns ?? []).map((turn) => turn.atSecond),
      chapter.draft?.locked,
      chapter.live ? chapter.start : null,
      chapter.live && chapter.ended ? chapter.end : null,
    ]
    for (const second of seconds) if (second != null) stops.set(second, null)
  }
  for (const event of events) if (!stops.get(event.at)) stops.set(event.at, event.id)
  return [...stops].map(([second, eventId]) => ({ second, eventId })).sort((a, b) => a.second - b.second)
}
