import { useRef, type MouseEvent, type PointerEvent } from "react"
import { useFollow } from "./use-retime"
import type { TimelineView } from "./use-timeline-view"

/** A touch that travels less than this is a tap. */
const TAP_PX = 8
/** A press this soon after another, this close to it, is the second half of a double click. */
const DOUBLE_MS = 500
const DOUBLE_PX = 4
/** The slowest double click a system lets a person set; a press older than that is the first half of none. */
const PAIR_MS = 5000

type Press = { x: number; drag: boolean; again: boolean }
type Pressed = { x: number; time: number; second: number }

/**
 * Presses on the empty track: a mouse seeks and drags at once, a touch seeks on its tap so a swipe still scrolls the
 * zoomed track. The view keeps its scale while a press lasts. The track may be fitted to another phase between the two
 * presses of a double click, so both mean the second the first one pointed at.
 */
export function usePlanePress({
  view,
  secondAt,
  onSeek,
}: {
  view: TimelineView
  secondAt: (clientX: number) => number
  onSeek: (second: number) => void
}) {
  const follow = useFollow(onSeek)
  const pointer = useRef<Press | null>(null)
  const last = useRef<Pressed | null>(null)
  /** The press before the last one: the first half of the double click the browser reports next. */
  const earlier = useRef<Pressed | null>(null)
  const held = useRef<(() => void) | null>(null)

  /**
   * Scale and scroll stand still until the press ends. The track lets go once its last seek is made, and the window
   * where the pointer was let go elsewhere. The window listens after the track, not before it: a browser draws what one
   * listener changed before it calls the next, so a track fitted first would place that last seek on another scale.
   */
  const hold = () => {
    held.current?.()
    view.hold(true)
    const done = () => {
      window.removeEventListener("pointerup", done)
      window.removeEventListener("pointercancel", done)
      if (held.current === done) held.current = null
      view.hold(false)
    }
    held.current = done
    window.addEventListener("pointerup", done)
    window.addEventListener("pointercancel", done)
  }
  const letGo = () => held.current?.()
  const near = (press: Press, clientX: number) => Math.abs(clientX - press.x) <= DOUBLE_PX

  return {
    down(event: PointerEvent<HTMLElement>) {
      if (event.pointerType === "touch") {
        // A tap is not kept, so no press before it may pass for the first half of a double tap.
        last.current = earlier.current = null
        pointer.current = { x: event.clientX, drag: false, again: false }
        return
      }
      const before = last.current
      const again =
        !!before && event.timeStamp - before.time < DOUBLE_MS && Math.abs(event.clientX - before.x) <= DOUBLE_PX
      const second = again ? before.second : secondAt(event.clientX)
      earlier.current = before
      last.current = { x: event.clientX, time: event.timeStamp, second }
      pointer.current = { x: event.clientX, drag: true, again }
      hold()
      follow(second, true)
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Synthetic or already-released pointers cannot be captured; dragging still works inside the track.
      }
    },
    /** Follows a drag; false while the pointer only passes over the track. */
    move(event: PointerEvent<HTMLElement>, second: number) {
      const press = pointer.current
      if (!press?.drag) return false
      // The second press of a double click stays on the second of the first, unless it becomes a drag.
      if (!press.again || !near(press, event.clientX)) follow(second)
      return true
    },
    up(event: PointerEvent<HTMLElement>, pinching: boolean) {
      const start = pointer.current
      pointer.current = null
      if (start && !pinching && !(start.again && near(start, event.clientX))) {
        const moved = Math.abs(event.clientX - start.x)
        // A drag ends somewhere else; a press soon after is a new one, not the second half of a double click.
        if (moved > DOUBLE_PX) last.current = null
        if (start.drag ? moved > 0 : moved < TAP_PX) follow(secondAt(event.clientX), true)
      }
      letGo()
    },
    cancel() {
      pointer.current = null
      letGo()
    },
    /**
     * The second a double click means: where its first press pointed, if it was a press of the mouse. The browser pairs
     * the presses by the speed a person set, so the first is the press before the last, however slow the pair was.
     */
    doubled(event: MouseEvent<HTMLElement>) {
      const first = earlier.current
      return first && event.timeStamp - first.time < PAIR_MS && Math.abs(event.clientX - first.x) <= DOUBLE_PX
        ? first.second
        : secondAt(event.clientX)
    },
  }
}
