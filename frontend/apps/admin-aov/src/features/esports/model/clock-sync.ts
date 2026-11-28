import type { GameContent, VodPause } from "@aov/community-contracts"
import { formatClock } from "@/lib/clock"
import type { RecordedChange } from "./desk"
import { chapterClock, type GameChapter } from "./series-vod"
import { withPlayback } from "./timeline-io"

/**
 * What the clock the game shows on screen says at a video second, against what is recorded. The broadcast may come
 * into a game after its 0:00, so a game is placed by the clock on screen rather than by its first frame; and a clock
 * that is behind once the game runs means it stood still for a while that no pause holds yet.
 */
export type ClockReading = {
  /** The clock typed from the screen. */
  shown: number
  /** The clock the recorded 0:00 and pauses give at that second; null where the game is not played yet. */
  recorded: number | null
  /** Where 0:00 goes for the screen to be right, with the pauses that came before that clock. */
  start: number
  /** Seconds the game stood still that no pause holds, when the screen is behind the recorded clock. */
  stillFor: number | null
}

/** Seconds of the video the recorded pauses take before a second of the game clock. */
const pausedBefore = (pauses: VodPause[], gameSecond: number) =>
  pauses
    .filter((pause) => pause.durationSeconds > 0 && pause.atSeconds < gameSecond)
    .reduce((total, pause) => total + pause.durationSeconds, 0)

export function readClock(chapter: GameChapter, videoSecond: number, shown: number): ClockReading {
  const start = Math.max(0, Math.round(videoSecond - shown - pausedBefore(chapter.sync.pauses, shown)))
  const playing = chapter.live && videoSecond >= chapter.start
  const recorded = playing ? Math.floor(chapterClock(chapter, videoSecond)) : null
  const stillFor = recorded !== null && recorded > shown ? recorded - shown : null
  return { shown, recorded, start, stillFor }
}

/** The pauses with a game that stood still `by` seconds more at a second of its clock: a pause there grows. */
function grow(pauses: VodPause[], atSeconds: number, by: number): VodPause[] {
  const same = pauses.some((pause) => pause.atSeconds === atSeconds)
  if (!same) return [...pauses, { atSeconds, durationSeconds: by }]
  return pauses
    .map((pause) => (pause.atSeconds === atSeconds ? { ...pause, durationSeconds: pause.durationSeconds + by } : pause))
    .filter((pause) => pause.durationSeconds > 0)
}

/**
 * The game stood still at a second of its clock for so long: a pause there grows, otherwise one is added. A pause read
 * while the game still stands is made longer by the next reading once it runs again. Each way is made to the game as
 * it is when it is written, so two within one save do not undo each other.
 */
export function stillChange(content: GameContent, atSeconds: number, durationSeconds: number): RecordedChange {
  const before = (content.timeline?.pauses ?? []).find((pause) => pause.atSeconds === atSeconds)?.durationSeconds ?? 0
  const pausesOf = (current: GameContent) => current.timeline?.pauses ?? []
  return {
    text: `Đã ghi tạm dừng lúc ${formatClock(atSeconds)}, dừng ${formatClock(before + durationSeconds)}`,
    apply: (current) => withPlayback(current, { pauses: grow(pausesOf(current), atSeconds, durationSeconds) }),
    revert: (current) => withPlayback(current, { pauses: grow(pausesOf(current), atSeconds, -durationSeconds) }),
  }
}
