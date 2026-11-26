import { firstOf, startOf } from "./watch-follow.ts"
import { placeAt, toStory } from "./watch-place.ts"
import type { KeptLength, WatchLength, WatchMatch, WatchTarget } from "./watch-types.ts"

/** Where a viewer left a match, and how far into its story they had come. */
export type WatchStop = { video: string; second: number; length: WatchLength; reached: number; done: boolean }
/** What this browser remembers of watching; the matches with the newest last. */
export type WatchMemory = { length: KeptLength; keys: boolean; matches: [string, WatchStop][] }

const KEPT = 60
const KEPT_LENGTHS: readonly unknown[] = ["games", "whole", "all"] satisfies KeptLength[]

const isKept = (length: unknown): length is KeptLength => KEPT_LENGTHS.includes(length)
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
const amount = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : null)

function readStop(value: unknown): WatchStop | null {
  if (!isRecord(value)) return null
  const { video, length, done } = value
  const [second, reached] = [amount(value.second), amount(value.reached)]
  if (typeof video !== "string" || second == null || reached == null) return null
  const own = length === "quick" || isKept(length) ? length : "whole"
  return { video, second: Math.floor(second), length: own, reached, done: done === true }
}

/** Reads what was written before; anything that cannot be read starts afresh. */
export function readMemory(text: string | null): WatchMemory {
  let read: unknown = null
  try {
    read = JSON.parse(text || "null")
  } catch {
    // Broken text is as good as none.
  }
  const { length, keys, matches } = isRecord(read) ? read : {}
  return {
    length: isKept(length) ? length : "whole",
    keys: keys !== false,
    matches: (Array.isArray(matches) ? matches : [])
      .flatMap((item: unknown): [string, WatchStop][] => {
        const [id, value] = Array.isArray(item) ? (item as unknown[]) : []
        const stop = readStop(value)
        return typeof id === "string" && stop ? [[id, stop]] : []
      })
      .slice(-KEPT),
  }
}

export function stopIn(memory: WatchMemory, seriesId: string): WatchStop | null {
  return memory.matches.find(([id]) => id === seriesId)?.[1] ?? null
}

export function remember(memory: WatchMemory, seriesId: string, stop: WatchStop): WatchMemory {
  const others = memory.matches.filter(([id]) => id !== seriesId)
  return { ...memory, matches: [...others, [seriesId, stop] satisfies [string, WatchStop]].slice(-KEPT) }
}

/** A viewer who stopped within these first seconds has not begun. */
export const BEGUN = 30

/**
 * Where a match is gone on with, or null when it starts afresh: not in its first seconds, not after its end. A break is
 * left for the next game.
 */
export function resumeOf(match: WatchMatch, stop: WatchStop | null): (WatchTarget & { length: WatchLength }) | null {
  const { story, cuts } = match
  if (!stop || stop.done || !story.videos.includes(stop.video)) return null
  const { video, second, length } = stop
  if (story.level === "PLAIN" || story.level === "NONE")
    return stop.reached >= BEGUN ? { video, second, length: "all" } : null

  const place = placeAt(story, video, second)
  if (place.state === "AFTER") return null
  if (place.state === "UNKNOWN") return second >= BEGUN ? { video, second, length } : null
  if (place.state === "SPAN") {
    const first = firstOf(story, cuts, "whole")
    const begun = first?.video !== video || second - first.second >= BEGUN
    return begun ? { video, second, length } : null
  }
  if (Math.min(stop.reached, toStory(story, video, second).at) < BEGUN) return null
  const next = place.state === "BREAK" ? place.next : null
  const start = next && startOf(next, cuts, length)
  return next?.video && start != null ? { video: next.video, second: start, length } : { video, second, length }
}
