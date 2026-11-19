import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import {
  markerKey,
  retimeRange,
  withinRange,
  type RetimeRange,
  type RetimeTarget,
} from "../../model/broadcast-timeline"
import type { GameChapter } from "../../model/series-vod"
import type { TimelineEvent } from "../../model/timeline"
import type { TimelineEditing } from "./timeline-rows"

/** A press that travels less than this is a click, so a marker is never moved by an unsteady hand. */
const DRAG_PX = 5
/** While a marker is dragged the video is asked to seek no more often than this, in milliseconds. */
const FOLLOW_MS = 140

type Press = {
  x: number
  moved: boolean
  key: string
  target: RetimeTarget
  from: number
  range: RetimeRange
  /** Where the video was when the press began, to return to if the drag is cancelled. */
  back: number
}

/** What the markers of the track read from `useMarkerDrag`. */
export type MarkerDrag = ReturnType<typeof useMarkerDrag>

/**
 * Moving the markers of the focused game along the track: dragged with the pointer, which the video follows a few
 * times a second, or nudged with Alt + arrows. A dropped marker waits where it landed until the saved game comes back.
 */
export function useMarkerDrag({
  editing,
  chapters,
  events,
  duration,
  current,
  secondAt,
  onSeek,
  onMoveStart,
}: {
  editing: TimelineEditing | undefined
  chapters: GameChapter[]
  events: TimelineEvent[]
  duration: number
  /** The playhead, in video seconds. */
  current: number
  /** The video second under a pointer position on the track. */
  secondAt: (clientX: number) => number
  onSeek: (second: number) => void
  /** A press has become a drag. */
  onMoveStart: () => void
}) {
  const [drag, setDrag] = useState<{ key: string; from: number; second: number } | null>(null)
  // Where a dropped marker waits until the saved game comes back, so it does not jump to its old place meanwhile.
  const [settled, setSettled] = useState<{ key: string; second: number } | null>(null)
  const press = useRef<Press | null>(null)
  const skipClick = useRef(false)
  const seekVideo = useRef(onSeek)
  seekVideo.current = onSeek
  const follow = useRef<{ last: number; timer: number | null; second: number }>({ last: 0, timer: null, second: 0 })
  useEffect(() => {
    const state = follow.current
    return () => {
      if (state.timer != null) window.clearTimeout(state.timer)
    }
  }, [])
  /** Seeks the video to a dragged position: at once when `now`, otherwise a few times a second at most. */
  const followVideo = (second: number, now = false) => {
    const state = follow.current
    state.second = second
    if (state.timer != null) {
      if (!now) return
      window.clearTimeout(state.timer)
      state.timer = null
    }
    const run = () => {
      state.timer = null
      state.last = Date.now()
      seekVideo.current(state.second)
    }
    const wait = now ? 0 : FOLLOW_MS - (Date.now() - state.last)
    if (wait <= 0) run()
    else state.timer = window.setTimeout(run, wait)
  }

  // The saved game has arrived (or the save failed): the marker shows what is stored again.
  useEffect(() => setSettled(null), [events, chapters])
  useEffect(() => {
    if (!settled) return
    const timer = window.setTimeout(() => setSettled(null), 4000)
    return () => window.clearTimeout(timer)
  }, [settled])

  /** Range a marker may be dragged in, or null when it stays where it is (read-only, or another game's marker). */
  const movable = (target: RetimeTarget) => {
    if (!editing || target.gameId !== editing.gameId) return null
    const index = chapters.findIndex((candidate) => candidate.gameId === target.gameId)
    const chapter = chapters[index]
    if (!chapter) return null
    // Games without a position in this video are only placed for reading order and bound nothing.
    return retimeRange(chapter, target, duration, {
      previousEnd:
        chapters
          .slice(0, index)
          .reverse()
          .find((candidate) => candidate.synced)?.end ?? null,
      nextFrom: chapters.slice(index + 1).find((candidate) => candidate.synced)?.from ?? null,
    })
  }
  const shownAt = (key: string, at: number) =>
    drag?.key === key ? drag.second : settled?.key === key ? settled.second : at
  const retime = (key: string, target: RetimeTarget, from: number, second: number) => {
    if (second === Math.round(from)) return
    setSettled({ key, second })
    editing?.onRetime(target, second)
  }
  // The drag is followed on the window, so it survives leaving the marker and the track.
  const startPress = (event: ReactPointerEvent<HTMLElement>, target: RetimeTarget, from: number) => {
    skipClick.current = false
    const range = movable(target)
    if (!range || (event.button ?? 0) !== 0) return
    press.current = { x: event.clientX, moved: false, key: markerKey(target), target, from, range, back: current }
    const move = (moved: PointerEvent) => {
      const state = press.current
      if (!state || (!state.moved && Math.abs(moved.clientX - state.x) < DRAG_PX)) return
      state.moved = true
      onMoveStart()
      const second = withinRange(secondAt(moved.clientX), state.range)
      setDrag({ key: state.key, from: state.from, second })
      followVideo(second)
    }
    const release = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", drop)
      window.removeEventListener("pointercancel", cancel)
      press.current = null
      setDrag(null)
    }
    const cancel = () => {
      const state = press.current
      release()
      if (state?.moved) followVideo(state.back, true)
    }
    const drop = (dropped: PointerEvent) => {
      const state = press.current
      release()
      if (!state?.moved) return
      // The click that ends a drag must not select the marker or seek to its old second; the next press clears it.
      skipClick.current = true
      const second = withinRange(secondAt(dropped.clientX), state.range)
      followVideo(second, true)
      retime(state.key, state.target, state.from, second)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", drop)
    window.addEventListener("pointercancel", cancel)
  }
  /** Alt + arrows move a focused marker by one second (Shift: five), for editors who do not drag. */
  const nudge = (event: ReactKeyboardEvent<HTMLElement>, target: RetimeTarget, from: number) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
    const range = event.altKey && delta ? movable(target) : null
    if (!range) return
    event.preventDefault()
    event.stopPropagation()
    const second = withinRange(from + delta * (event.shiftKey ? 5 : 1), range)
    followVideo(second, true)
    retime(markerKey(target), target, from, second)
  }
  const clicked = (run: () => void) => () => {
    if (skipClick.current) {
      skipClick.current = false
      return
    }
    run()
  }

  /**
   * What a marker drawn at video second `from` carries: whether it can move, and the attributes and handlers of a
   * press, Alt + arrows and a click. A pill standing for several moments has no target, only the click, and is known
   * by its own key.
   */
  const marker = (target: RetimeTarget | null, from: number, onClick: () => void, ownKey = "") => {
    const key = target ? markerKey(target) : ownKey
    const canMove = !!target && !!movable(target)
    return {
      key,
      canMove,
      props: {
        "data-marker": true,
        "data-movable": canMove || undefined,
        "data-dragging": drag?.key === key || undefined,
        "aria-keyshortcuts": canMove ? "Alt+ArrowLeft Alt+ArrowRight" : undefined,
        onPointerDown: (event: ReactPointerEvent<HTMLElement>) => target && startPress(event, target, from),
        onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => target && nudge(event, target, from),
        onClick: clicked(onClick),
      },
    }
  }

  return {
    drag,
    /** The press under way, if any; the track neither scrubs nor scrolls under a dragged marker. */
    press,
    /** A new press on the track ends the wait for the click that follows a drop. */
    pressTrack: () => {
      skipClick.current = false
    },
    shownAt,
    marker,
  }
}
