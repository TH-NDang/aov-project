import { crossed, type EpicCall } from "@aov/ui/lib/battle-map"
import type { Place } from "./watch-types.ts"

/** The most a game's clock moves between two readings of a video that plays on; a longer move is a jump. */
const PLAYED = 3

/** How long a reminder stays over the video, in milliseconds. */
export const CALL_SHOWN = 8000

export type ClockReading = { chapter: number; clock: number }

/** Where the clock of the game being played stands; null in a draft, a pause, between games or without a clock. */
export const readingOf = (place: Place | null): ClockReading | null =>
  place?.state === "PLAY" ? { chapter: place.chapter.index, clock: place.clock } : null

/**
 * The big monster call the clock has just played past, or null. A jump, another game or a pause of the broadcast calls
 * nothing: a reminder is for the moment as it happens, not for one the reader skips to.
 */
export function callAt(calls: readonly EpicCall[], before: ClockReading | null, after: ClockReading | null) {
  if (!before || !after || before.chapter !== after.chapter) return null
  const moved = after.clock - before.clock
  if (moved <= 0 || moved > PLAYED) return null
  return crossed(calls, before.clock, after.clock).at(-1) ?? null
}

const KEY = "aov-stream-objective-calls"

function readSwitch() {
  try {
    return localStorage.getItem(KEY) !== "off"
  } catch {
    return true
  }
}

let on = readSwitch()
const listeners = new Set<() => void>()

/** Whether big monster reminders show over the video; on unless the reader turned them off, kept in this browser. */
export const callSwitch = {
  on: () => on,
  set(next: boolean) {
    on = next
    try {
      localStorage.setItem(KEY, next ? "on" : "off")
    } catch {
      /* Without storage the choice lasts until the page is left. */
    }
    for (const listener of listeners) listener()
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
