import { useEffect, useEffectEvent, useLayoutEffect, useRef, type RefObject } from "react"
import { clampSpan } from "../../model/broadcast-timeline"

/** Wheel travel, in pixels, that changes the span by a factor of e; one notch of a mouse wheel is about a third. */
const WHEEL_ZOOM_PX = 300

/**
 * Zooming the broadcast track: Ctrl + wheel (a trackpad pinch arrives the same way) and a two-finger pinch change the
 * span around the point under the pointer. Returns whether a pinch is under way, so lifting its fingers is not a tap.
 */
export function useTimelineZoom({
  viewport,
  track,
  duration,
  shown,
  current,
  setSpan,
  scrollTo,
}: {
  viewport: RefObject<HTMLDivElement | null>
  track: RefObject<HTMLDivElement | null>
  duration: number
  /** The span on screen now, in seconds of video. */
  shown: number
  /** The playhead, in seconds of video. */
  current: number
  setSpan: (span: number) => void
  scrollTo: (second: number) => void
}) {
  // A gesture zooms around a point: the video second under it and where that sits in the viewport. The track is
  // put back under the point before the browser paints the new width.
  const anchor = useRef<{ second: number; offset: number } | null>(null)
  const spanNow = useRef(shown)
  spanNow.current = shown
  const zoomAround = (wanted: number, clientX: number) => {
    const element = viewport.current
    const bar = track.current
    const next = clampSpan(duration, wanted)
    if (!element || !bar || next === spanNow.current) return
    const rect = bar.getBoundingClientRect()
    anchor.current = {
      second: Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width))) * duration,
      offset: clientX - element.getBoundingClientRect().left,
    }
    // Several wheel events arrive between two renders; each continues from the last one.
    spanNow.current = next
    setSpan(next)
  }
  const gestures = useRef({ zoomAround })
  gestures.current = { zoomAround }
  const pinching = useRef(false)
  useLayoutEffect(() => {
    const point = anchor.current
    const element = viewport.current
    const bar = track.current
    if (!point || !element || !bar) return
    const rect = bar.getBoundingClientRect()
    const start = rect.left - element.getBoundingClientRect().left + element.scrollLeft
    element.scrollLeft = start + (point.second / duration) * rect.width - point.offset
  }, [shown, duration, viewport, track])
  // Keyed on the span, not the scale or the playhead: the player corrects the video length by a second once it starts,
  // and neither that nor the video playing on may move the track.
  const showPlayhead = useEffectEvent(() => scrollTo(current))
  useEffect(() => {
    if (anchor.current) anchor.current = null
    else showPlayhead()
  }, [shown])
  // Ctrl + wheel (a pinch on a trackpad arrives the same way) and a two-finger pinch on a touch screen zoom the
  // track. The listeners are attached by hand because they must be able to cancel the browser's own page zoom.
  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const travel = event.deltaY * (event.deltaMode === 1 ? 33 : 1)
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
    element.addEventListener("wheel", onWheel, { passive: false })
    element.addEventListener("touchstart", onTouchStart, { passive: true })
    element.addEventListener("touchmove", onTouchMove, { passive: false })
    element.addEventListener("touchend", onTouchEnd)
    element.addEventListener("touchcancel", onTouchEnd)
    return () => {
      element.removeEventListener("wheel", onWheel)
      element.removeEventListener("touchstart", onTouchStart)
      element.removeEventListener("touchmove", onTouchMove)
      element.removeEventListener("touchend", onTouchEnd)
      element.removeEventListener("touchcancel", onTouchEnd)
    }
  }, [viewport])
  return pinching
}
