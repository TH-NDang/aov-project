import { useRef, useState, type PointerEvent } from "react"
import { watch } from "../../../components/watch-session"
import { pressAt, readAt } from "../../../lib/watch-bar"
import { startOf } from "../../../lib/watch-follow"
import type { Bar, BarRead, Chapter, Cuts } from "../../../lib/watch-types"

/** Pixels a finger moves sideways before it drags along the bar; less may be the start of a scroll. */
const DRAG = 4

/** Plays a game from where the length being watched begins it. */
export function playGame(chapter: Chapter, cuts: Cuts) {
  const second = startOf(chapter, cuts, watch.view().length)
  if (chapter.video && second != null) watch.go({ video: chapter.video, second })
}

/** What stands at a point of the bar; the line between two parts of a game belongs to the later one. */
function readNear(bar: Bar, x: number, reached: number) {
  const read = readAt(bar, x, reached)
  if (!read || read.part) return read
  const { cell } = read
  const later = cell.parts.find(({ left }) => cell.left + left >= x)
  return later ? readAt(bar, cell.left + later.left, reached) : read
}

/** Plays what a point of the bar stands for. A game without points on it begins, unless the video is in it. */
function playRead(read: BarRead | null, cuts: Cuts) {
  const target = pressAt(read)
  if (target) return watch.go(target)
  const game = read && (read.cell.chip || read.cell.blank) ? read.cell.chapter : null
  if (game && game !== watch.view().place?.chapter) playGame(game, cuts)
}

/**
 * What a pointer reads on the bar: the mouse wherever it is over it, a finger while it drags along it. What stands
 * there as the pointer is let go is played, so that a drag moves the video once.
 */
export function useStoryPointer(bar: Bar, reached: number, cuts: Cuts) {
  const [x, setX] = useState<number | null>(null)
  const press = useRef<{ id: number; from: number } | null>(null)
  const at = ({ currentTarget, clientX }: PointerEvent<HTMLElement>) => {
    const { left, width } = currentTarget.getBoundingClientRect()
    return Math.min(width, Math.max(0, clientX - left))
  }
  const leave = () => {
    press.current = null
    setX(null)
  }
  return {
    /** What is read; null while nothing is, and between two games. */
    read: x == null ? null : readNear(bar, x, reached),
    handlers: {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (!event.isPrimary || event.button !== 0) return
        press.current = { id: event.pointerId, from: event.clientX }
        event.currentTarget.setPointerCapture(event.pointerId)
        if (event.pointerType === "mouse") setX(at(event))
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const mouse = event.pointerType === "mouse"
        const held = press.current
        if (held ? held.id !== event.pointerId : !mouse) return
        if (held && !mouse && x == null && Math.abs(event.clientX - held.from) < DRAG) return
        setX(at(event))
      },
      onPointerUp(event: PointerEvent<HTMLElement>) {
        if (press.current?.id !== event.pointerId) return
        press.current = null
        if (event.pointerType !== "mouse") setX(null)
        playRead(readNear(bar, at(event), reached), cuts)
      },
      onPointerLeave() {
        if (!press.current) leave()
      },
      onPointerCancel: leave,
    },
  }
}
