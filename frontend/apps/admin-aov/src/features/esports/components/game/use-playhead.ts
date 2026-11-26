import { useEffect, useState, useSyncExternalStore } from "react"
import { createPlayhead, type Playhead } from "../../model/playhead"

/** Every reading of the playhead; only for the parts of the screen that move with it. */
export const usePlayhead = (playhead: Playhead): number => useSyncExternalStore(playhead.subscribe, playhead.get)

/** One value read from the playhead: the caller draws again only when the value changes, not four times a second. */
export function usePlayheadValue<T extends string | number | boolean | null>(
  playhead: Playhead,
  select: (second: number) => T,
): T {
  return useSyncExternalStore(playhead.subscribe, () => select(playhead.get()))
}

const SAVE_MS = 400

function savedSecond(key: string): number | null {
  try {
    const value = localStorage.getItem(key)
    const second = value === null ? Number.NaN : Number(value)
    return Number.isFinite(second) && second >= 0 ? second : null
  } catch {
    return null
  }
}

/**
 * The playhead of a match: a shared `?t=` link wins, otherwise the last position this browser watched (a convenience of
 * the viewer, so it stays in localStorage). The object is the same for the life of the match. Another video changes only
 * the place it is remembered under; whoever switches the video sets the second it goes to.
 */
export function useMatchPlayhead(
  matchId: string,
  videoId: string | null,
  mainVideoId: string | null,
  fromLink: number | null,
  initial: number,
): Playhead {
  const other = videoId !== null && mainVideoId !== null && videoId !== mainVideoId
  const key = `aov-esports:playhead:v1:series:${matchId}${other ? `:${videoId}` : ""}`
  const [playhead] = useState(() => createPlayhead(fromLink ?? savedSecond(key) ?? initial))

  useEffect(() => {
    let timer: number | null = null
    const remember = () => {
      timer ??= window.setTimeout(() => {
        timer = null
        try {
          localStorage.setItem(key, String(Math.round(playhead.get())))
        } catch {
          // Private mode or blocked storage: progress simply is not remembered.
        }
      }, SAVE_MS)
    }
    const stop = playhead.subscribe(remember)
    return () => {
      stop()
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [playhead, key])

  return playhead
}
