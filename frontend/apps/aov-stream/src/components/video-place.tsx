import { useLayoutEffect, useRef, type ReactNode } from "react"

/** Where the video of a match stands: the box it fills, and the room that box is in. */
export type VideoSpot = { seriesId: string; box: HTMLElement; room: HTMLElement }

let spot: VideoSpot | null = null
const listeners = new Set<() => void>()

function settle(next: VideoSpot | null) {
  spot = next
  for (const listener of listeners) listener()
}

/** The place of the page that is open, or null on a page without one. */
export const placeNow = () => spot

/** Hears of every place that comes or goes, as it stands in the document and before it is drawn. */
export function onPlace(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Brings a room to the top of the window, whatever the video covers there. */
export function showRoom(room: HTMLElement, behavior: ScrollBehavior = "instant") {
  window.scrollTo({ top: room.getBoundingClientRect().top + window.scrollY, behavior })
}

/** Brings the room of the page to the top of the window, and the focus into it. */
export function enterRoom(behavior?: ScrollBehavior) {
  if (!spot) return
  showRoom(spot.room, behavior)
  spot.room.focus({ preventScroll: true })
}

/** The place of the video in its room. The frame is laid over it (video-frame.tsx); nothing is drawn here. */
export function VideoPlace({ seriesId }: { seriesId: string }): ReactNode {
  const box = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = box.current!
    const own = { seriesId, box: element, room: element.closest<HTMLElement>("[data-video-room]") ?? element }
    settle(own)
    return () => {
      // A room that takes the place of this one may have settled before it goes.
      if (spot === own) settle(null)
    }
  }, [seriesId])
  return <div ref={box} style={{ position: "absolute", inset: 0 }} />
}
