import { useLayoutEffect, useMemo, useState } from "react"
import { shapeOf } from "../../../lib/watch-shape"
import type { RoomBar, RoomShape } from "../../../lib/watch-types"

/** On a touch screen a height that changes by less is the address bar folding away, not another window. */
const FOLD = 120

/** Without the scrollbar, which the window's own width counts in. */
const measure = () => ({ width: document.documentElement.clientWidth, height: window.innerHeight })

/**
 * The shape the room takes in the window, and the window it was taken for. Both are read while rendering, so the room
 * stands right in its first frame.
 */
export function useRoomShape(kind: RoomBar): { width: number; height: number; shape: RoomShape } {
  const [{ width, height }, setSize] = useState(measure)
  useLayoutEffect(() => {
    const read = () =>
      setSize((current) => {
        const next = measure()
        const change = Math.abs(next.height - current.height)
        const folded = change < FOLD && window.matchMedia("(hover: none)").matches
        return next.width === current.width && (change === 0 || folded) ? current : next
      })
    read()
    window.addEventListener("resize", read)
    // A scrollbar that comes or goes changes the width without a resize of the window.
    const root = new ResizeObserver(read)
    root.observe(document.documentElement)
    return () => {
      window.removeEventListener("resize", read)
      root.disconnect()
    }
  }, [])
  const shape = useMemo(() => shapeOf(width, height, kind), [width, height, kind])
  return { width, height, shape }
}
