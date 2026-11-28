import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { neighboursOf, retimeRange, type RetimeTarget } from "../../../model/broadcast-timeline"
import type { Playhead } from "../../../model/playhead"
import type { GameChapter } from "../../../model/series-vod"
import type { TimelineEditing } from "./match-timeline"

/** A press that travels less than this is a click, so a marker is never moved by an unsteady hand. */
const DRAG_PX = 5
/** While something is dragged the video is asked to seek no more often than this, in milliseconds. */
const FOLLOW_MS = 140
/** How long a dropped marker waits for the saved game before it shows what is stored again, in milliseconds. */
const SETTLED_MS = 4000
/**
 * How long Alt + arrows wait for the next press before the mark is written: presses in a row and a held key add up to
 * one change, so one undo takes them back and the list of 20 is not filled by one movement.
 */
const NUDGE_MS = 600

type Span = { min: number; max: number }
type Press = {
  x: number
  moved: boolean
  key: string
  target: RetimeTarget
  from: number
  range: Span
  /** From the second under the pointer to the mark's own, so a mark held at its edge does not jump. */
  grip: number
  /** Where the video was when the press began, to return to if the drag is cancelled. */
  back: number
}
export type Drag = { key: string; target: RetimeTarget; from: number; second: number }
/** A mark moved with the keys and not written yet: `from` is where it is stored. */
type Nudge = Drag

export const keyOf = (target: RetimeTarget) =>
  target.kind === "event"
    ? `event:${target.gameId}|${target.id}`
    : target.kind === "mark"
      ? `mark:${target.gameId}|${target.side}|${target.part}|${target.at}`
      : `${target.kind}:${target.gameId}`

const within = (second: number, range: Span) => Math.min(range.max, Math.max(range.min, Math.round(second)))

/** Seeks the video to a dragged position: at once when `now`, otherwise a few times a second at most. */
export function useFollow(onSeek: (second: number) => void) {
  const seek = useRef(onSeek)
  seek.current = onSeek
  const state = useRef<{ last: number; timer: number | null; second: number }>({ last: 0, timer: null, second: 0 })
  useEffect(() => {
    const held = state.current
    return () => {
      if (held.timer !== null) window.clearTimeout(held.timer)
    }
  }, [])
  return useCallback((second: number, now = false) => {
    const held = state.current
    held.second = second
    if (held.timer !== null) {
      if (!now) return
      window.clearTimeout(held.timer)
      held.timer = null
    }
    const run = () => {
      held.timer = null
      held.last = Date.now()
      seek.current(held.second)
    }
    const wait = now ? 0 : FOLLOW_MS - (Date.now() - held.last)
    if (wait <= 0) run()
    else held.timer = window.setTimeout(run, wait)
  }, [])
}

/**
 * Moving the marks of the chosen game along the track. The video follows a drag, so a mark is placed by the picture and
 * not by the number; Esc or a cancelled pointer puts mark and video back.
 */
export function useRetime({
  playhead,
  duration,
  chapters,
  events,
  editing,
  secondAt,
  onSeek,
  onHold,
}: {
  playhead: Playhead
  duration: number
  chapters: GameChapter[]
  /** What is drawn; another array means the saved game has arrived. */
  events: unknown
  editing: TimelineEditing | undefined
  secondAt: (clientX: number) => number
  onSeek: (second: number) => void
  /** A mark is pressed, or let go of: the track keeps its scale meanwhile. */
  onHold?: (held: boolean) => void
}) {
  const [drag, setDrag] = useState<Drag | null>(null)
  // Where a dropped marker waits until the saved game comes back, so it does not jump to its old place meanwhile.
  const [settled, setSettled] = useState<{ key: string; second: number } | null>(null)
  const press = useRef<Press | null>(null)
  const release = useRef<(() => void) | null>(null)
  const skipClick = useRef(false)
  const nudging = useRef<Nudge | null>(null)
  const nudgeTimer = useRef<number | null>(null)
  const follow = useFollow(onSeek)

  // A save of something else may arrive while keys still move a mark; that mark keeps the place they gave it.
  useEffect(() => {
    if (!nudging.current) setSettled(null)
  }, [events, chapters])
  useEffect(() => {
    if (!settled) return
    const timer = window.setTimeout(() => setSettled(null), SETTLED_MS)
    return () => window.clearTimeout(timer)
  }, [settled])

  /** Range a marker may be dragged in, or null when it stays where it is (read-only, or another game's marker). */
  const movable = (target: RetimeTarget) => {
    if (!editing || target.gameId !== editing.gameId) return null
    const chapter = chapters.find((candidate) => candidate.gameId === target.gameId)
    return chapter ? retimeRange(chapter, target, duration, neighboursOf(chapters, chapter.gameId)) : null
  }

  const move = (key: string, target: RetimeTarget, from: number, second: number) => {
    if (second === Math.round(from)) return
    setSettled({ key, second })
    editing?.onRetime(target, second)
  }

  /** Writes what the keys moved, once. */
  const commit = () => {
    if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current)
    nudgeTimer.current = null
    const state = nudging.current
    nudging.current = null
    if (state) move(state.key, state.target, state.from, state.second)
  }
  // The track may go while a moved mark waits to be written; what the keys did is still written.
  const commitLast = useRef(commit)
  commitLast.current = commit
  useEffect(
    () => () => {
      release.current?.()
      commitLast.current()
    },
    [],
  )

  // The drag is followed on the window, so it survives leaving the marker and the track.
  const startPress = (event: ReactPointerEvent<HTMLElement>, target: RetimeTarget | null, from: number) => {
    skipClick.current = false
    const range = target && movable(target)
    if (!target || !range || (event.button ?? 0) !== 0) return
    commit()
    const grip = from - secondAt(event.clientX)
    press.current = {
      x: event.clientX,
      moved: false,
      key: keyOf(target),
      target,
      from,
      range,
      grip,
      back: playhead.get(),
    }
    onHold?.(true)
    const onMove = (moved: PointerEvent) => {
      const state = press.current
      if (!state || (!state.moved && Math.abs(moved.clientX - state.x) < DRAG_PX)) return
      state.moved = true
      const second = within(secondAt(moved.clientX) + state.grip, state.range)
      setDrag({ key: state.key, target: state.target, from: state.from, second })
      follow(second)
    }
    const end = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onDrop)
      window.removeEventListener("pointercancel", onCancel)
      window.removeEventListener("keydown", onKey, true)
      release.current = null
      press.current = null
      setDrag(null)
      onHold?.(false)
    }
    const onCancel = () => {
      const state = press.current
      end()
      if (state?.moved) follow(state.back, true)
    }
    const onKey = (key: KeyboardEvent) => {
      if (key.key !== "Escape" || !press.current?.moved) return
      key.preventDefault()
      key.stopPropagation()
      onCancel()
      // The button is still down; the click of its release must not select the mark.
      skipClick.current = true
    }
    const onDrop = (dropped: PointerEvent) => {
      const state = press.current
      // The second under the pointer is read before the track may fit the phase the drop is in.
      const second = state ? within(secondAt(dropped.clientX) + state.grip, state.range) : 0
      end()
      if (!state?.moved) return
      // The click that ends a drag must not select the marker or seek to its old second; the next press clears it.
      skipClick.current = true
      follow(second, true)
      move(state.key, state.target, state.from, second)
    }
    release.current = end
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onDrop)
    window.addEventListener("pointercancel", onCancel)
    window.addEventListener("keydown", onKey, true)
  }

  /**
   * Alt + arrows move a focused marker by one second (Shift: five), for editors who do not drag. Each press goes on from
   * where the last one put the mark; the mark is written once the presses stop.
   */
  const nudge = (event: ReactKeyboardEvent<HTMLElement>, target: RetimeTarget, from: number) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
    const range = event.altKey && delta ? movable(target) : null
    if (!range) return
    event.preventDefault()
    event.stopPropagation()
    const key = keyOf(target)
    if (nudging.current && nudging.current.key !== key) commit()
    const going = nudging.current
    const start = going ? going.second : drag?.key === key ? drag.second : settled?.key === key ? settled.second : from
    const second = within(start + delta * (event.shiftKey ? 5 : 1), range)
    nudging.current = { key, target, from: going?.from ?? from, second }
    setSettled({ key, second })
    follow(second, !event.repeat)
    if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current)
    nudgeTimer.current = window.setTimeout(commit, NUDGE_MS)
  }

  return {
    drag,
    movable,
    startPress,
    nudge,
    /** Where a marker stands: dragged, dropped and waiting, or as it is stored. */
    shownAt: (key: string, at: number) =>
      drag?.key === key ? drag.second : settled?.key === key ? settled.second : at,
    /** Whether a marker is being moved or waits where it was dropped, so it stands at its true second. */
    isMoved: (key: string) => drag?.key === key || settled?.key === key,
    held: () => !!press.current?.moved,
    pressed: () => !!press.current,
    /** A click that is not the end of a drag. */
    clicked: (run: () => void) => () => {
      if (skipClick.current) {
        skipClick.current = false
        return
      }
      run()
    },
  }
}

export type Retime = ReturnType<typeof useRetime>
