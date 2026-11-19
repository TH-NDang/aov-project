import { useCallback, useEffect, useEffectEvent, useRef, useState, type RefObject, type UIEvent } from "react"
import { defaultSpan, timelineSpans } from "../../model/broadcast-timeline"
import type { GameChapter } from "../../model/series-vod"
import { useTimelineZoom } from "./use-timeline-zoom"

/**
 * How much of the video the detail track shows and where it is scrolled. Until the editor picks a span the track
 * follows the focused game, so a twelve-hour broadcast opens on the game being recorded instead of needing several
 * zoom steps. The playhead is kept in view after jumps and when the scale changes.
 */
export function useTimelineView({
  viewport,
  track,
  duration,
  current,
  focused,
  press,
}: {
  viewport: RefObject<HTMLDivElement | null>
  track: RefObject<HTMLDivElement | null>
  duration: number
  /** The playhead, in video seconds. */
  current: number
  focused: GameChapter | null | undefined
  /** A marker being dragged; the track never scrolls under it. */
  press: RefObject<{ moved: boolean } | null>
}) {
  // How much video the track shows at once. Null until the editor picks a span: the track then follows the focused
  // game.
  const [span, setSpan] = useState<number | null>(null)
  const spans = timelineSpans(duration)
  const shown = span ?? defaultSpan(duration, focused)
  const zoom = duration / shown
  const [width, setWidth] = useState(800)
  const [scroll, setScroll] = useState({ left: 0, visible: 1 })

  useEffect(() => {
    const element = track.current
    if (!element || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width || 800))
    observer.observe(element)
    return () => observer.disconnect()
  }, [track])

  const scrollTo = useCallback(
    (second: number, behavior: ScrollBehavior = "auto") => {
      const element = viewport.current
      if (!element) return
      const position = (second / duration) * (track.current?.clientWidth ?? 0)
      element.scrollTo?.({ left: position - element.clientWidth / 2, behavior })
    },
    [duration, viewport, track],
  )
  // Keep the playhead in view after jumps and when the scale changes.
  const previous = useRef(current)
  useEffect(() => {
    const jumped = Math.abs(current - previous.current) > 2
    previous.current = current
    const element = viewport.current
    // The video follows a drag; scrolling the track under the pointer would pull the marker away from it.
    if (!jumped || !element || press.current?.moved) return
    const position = (current / duration) * (track.current?.clientWidth ?? 0)
    if (position < element.scrollLeft || position > element.scrollLeft + element.clientWidth) scrollTo(current)
  }, [current, duration, scrollTo, viewport, track, press])
  const pinching = useTimelineZoom({ viewport, track, duration, shown, current, setSpan, scrollTo })
  // While the span follows the focused game, a change of game brings that whole game into view.
  const following = span === null
  const focusedId = focused?.gameId
  const focusedMiddle = focused ? (focused.from + focused.end) / 2 : null
  // The middle is read when the game or the mode changes, not each time the game's length is corrected.
  const showFocusedGame = useEffectEvent(() => {
    if (focusedMiddle !== null) scrollTo(focusedMiddle)
  })
  useEffect(() => {
    if (following) showFocusedGame()
  }, [following, focusedId])

  /** Back to the span chosen for the focused game, with that game in the middle. */
  const fitChapter = (chapter: GameChapter) => {
    setSpan(null)
    window.requestAnimationFrame?.(() => scrollTo((chapter.from + chapter.end) / 2))
  }
  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget
    setScroll({
      left: element.scrollLeft / Math.max(1, element.scrollWidth),
      visible: element.clientWidth / Math.max(1, element.scrollWidth),
    })
  }

  return { spans, shown, zoom, width, scroll, following, setSpan, scrollTo, fitChapter, onScroll, pinching }
}
