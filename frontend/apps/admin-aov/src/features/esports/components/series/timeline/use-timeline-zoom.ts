import { useCallback, useEffect, useRef, type RefObject } from "react"
import { clampSpan } from "../../../model/broadcast-timeline"

/** Wheel travel, in pixels, that changes the span by a factor of e; one notch of a mouse wheel is about a third. */
const WHEEL_ZOOM_PX = 300

/** Whether a wheel over `element` already scrolls something around it, such as the page of a narrow window. */
function pageScrolls(element: HTMLElement) {
  for (let node = element.parentElement; node; node = node.parentElement)
    if (node.scrollHeight > node.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(node).overflowY)) return true
  return false
}

/**
 * Zooming the track: Ctrl + wheel (a trackpad pinch arrives the same way) and a two-finger pinch change the span around
 * the point under the pointer. A plain wheel scrolls the page, or the track where the page has nothing to scroll.
 * `holdPoint` puts the track back under that point once the new width is drawn; it answers whether there was one.
 */
export function useTimelineZoom({
  viewport,
  plane,
  duration,
  shown,
  setSpan,
}: {
  /** The box the track scrolls in; null while the track is folded. */
  viewport: HTMLDivElement | null
  plane: RefObject<HTMLDivElement | null>
  duration: number
  /** The span on screen now, in seconds of video. */
  shown: number
  setSpan: (span: number) => void
}) {
  // A gesture zooms around a point: the video second under it and where that sits in the viewport.
  const anchor = useRef<{ second: number; offset: number } | null>(null)
  const spanNow = useRef(shown)
  spanNow.current = shown
  const zoomAround = (wanted: number, clientX: number) => {
    const bar = plane.current
    const next = clampSpan(duration, wanted)
    if (!viewport || !bar || next === spanNow.current) return
    const rect = bar.getBoundingClientRect()
    anchor.current = {
      second: Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width))) * duration,
      offset: clientX - viewport.getBoundingClientRect().left,
    }
    // Several wheel events arrive between two renders; each continues from the last one.
    spanNow.current = next
    setSpan(next)
  }
  const gestures = useRef({ zoomAround })
  gestures.current = { zoomAround }
  const pinching = useRef(false)

  const holdPoint = useCallback(() => {
    const point = anchor.current
    const bar = plane.current
    anchor.current = null
    if (!point || !viewport || !bar) return false
    const rect = bar.getBoundingClientRect()
    const start = rect.left - viewport.getBoundingClientRect().left + viewport.scrollLeft
    viewport.scrollLeft = start + (point.second / duration) * rect.width - point.offset
    return true
  }, [viewport, plane, duration])

  // The listeners are attached by hand because they must be able to cancel the browser's own page zoom.
  useEffect(() => {
    if (!viewport) return
    const onWheel = (event: WheelEvent) => {
      const travel = event.deltaY * (event.deltaMode === 1 ? 33 : 1)
      if (!event.ctrlKey && !event.metaKey) {
        if (!event.shiftKey && Math.abs(event.deltaY) > Math.abs(event.deltaX) && !pageScrolls(viewport))
          viewport.scrollLeft += travel
        return
      }
      event.preventDefault()
      const factor = Math.exp(Math.max(-WHEEL_ZOOM_PX, Math.min(WHEEL_ZOOM_PX, travel)) / WHEEL_ZOOM_PX)
      gestures.current.zoomAround(spanNow.current * factor, event.clientX)
    }
    let pinch: { apart: number; span: number } | null = null
    const apart = (touches: TouchList) =>
      Math.max(24, Math.hypot(touches[0]!.clientX - touches[1]!.clientX, touches[0]!.clientY - touches[1]!.clientY))
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return
      pinching.current = true
      pinch = { apart: apart(event.touches), span: spanNow.current }
    }
    const onTouchMove = (event: TouchEvent) => {
      if (!pinch || event.touches.length !== 2) return
      event.preventDefault()
      const middle = (event.touches[0]!.clientX + event.touches[1]!.clientX) / 2
      gestures.current.zoomAround((pinch.span * pinch.apart) / apart(event.touches), middle)
    }
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinch = null
      // The fingers of a pinch lift one after the other; neither lift is a tap that seeks.
      if (event.touches.length === 0) window.setTimeout(() => (pinching.current = false), 0)
    }
    viewport.addEventListener("wheel", onWheel, { passive: false })
    viewport.addEventListener("touchstart", onTouchStart, { passive: true })
    viewport.addEventListener("touchmove", onTouchMove, { passive: false })
    viewport.addEventListener("touchend", onTouchEnd)
    viewport.addEventListener("touchcancel", onTouchEnd)
    return () => {
      viewport.removeEventListener("wheel", onWheel)
      viewport.removeEventListener("touchstart", onTouchStart)
      viewport.removeEventListener("touchmove", onTouchMove)
      viewport.removeEventListener("touchend", onTouchEnd)
      viewport.removeEventListener("touchcancel", onTouchEnd)
    }
  }, [viewport])

  return { pinching, holdPoint }
}
