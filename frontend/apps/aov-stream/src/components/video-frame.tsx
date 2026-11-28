import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { coverOf, playsUnseen, videoForm, type VideoForm } from "../lib/video-form"
import type { RoomShape } from "../lib/watch-types"
import { statusWords } from "../lib/watch-words"
import { streamText, useStreamLocale } from "./stream-locale"
import { useWatch } from "./use-watch"
import { useWatchKeys } from "./use-watch-keys"
import { VideoMini } from "./video-mini"
import { ObjectiveCall } from "./objective-call"
import { enterRoom, onPlace, placeNow, type VideoSpot } from "./video-place"
import { watch } from "./watch-session"
import "./video-frame.css"

/** How far the page is scrolled before a paused video that is pinned slides out of the way, or comes back. */
const TURN = 24
/** The bar of the app with its line; a room that ends above it has given way to the bar of its page. */
const BAR = 57

/** The share of a box that stands in the window. */
function seenOf({ top, bottom, height }: DOMRect) {
  return height ? Math.max(0, Math.min(bottom, window.innerHeight) - Math.max(top, 0)) / height : 0
}

/** Whether a paused video is out of the way: scrolled down it leaves, scrolled up it comes back. */
function slideAway() {
  let turn = window.scrollY
  let away = false
  return (free: boolean) => {
    const top = window.scrollY
    if (!free) {
      away = false
      turn = top
    } else if (away ? top > turn : top < turn) turn = top
    else if (Math.abs(top - turn) >= TURN) {
      away = !away
      turn = top
    }
    return away
  }
}

/**
 * Lays the frame out over its place, and says how. It writes to the element itself: a place comes and goes inside the
 * update that changes the page, whose picture is taken before the frame would be drawn again.
 */
function useVideoForm(frame: RefObject<HTMLDivElement | null>, wide: boolean, spot: VideoSpot | null): VideoForm {
  const [form, setForm] = useState<VideoForm>("none")
  const seriesId = useWatch((view) => view.match?.seriesId)
  const player = useWatch((view) => view.player)
  const lay = useRef(() => {})

  useLayoutEffect(() => {
    const element = frame.current!
    const root = document.documentElement
    const slide = slideAway()
    const measure = ({ style }: HTMLElement, name: string, value: number) => {
      const length = `${value}px`
      if (style.getPropertyValue(name) !== length) style.setProperty(name, length)
    }
    lay.current = () => {
      const { match, player } = watch.view()
      const open = player !== "CLOSED"
      const before = element.dataset.form as VideoForm
      if (!match && before === "none" && !root.hasAttribute("data-room")) return
      const place = placeNow()
      const here = place && place.seriesId === match?.seriesId ? place : null
      const box = here?.box.getBoundingClientRect()
      const room = here?.room.getBoundingClientRect()
      const playing = player === "PLAYING" || player === "WAITING"
      const shape = here?.room.dataset.shape as RoomShape["shape"] | undefined
      const seen = box ? seenOf(box) : 0
      const takes = (box?.height ?? 0) / window.innerHeight
      const next = videoForm({ open, wide, here: !!here, shape: shape ?? null, seen, takes, playing, before })
      const origin = element.parentElement?.getBoundingClientRect()
      if (box && origin && (next === "room" || next === "pinned")) {
        measure(element, "--video-x", box.left - origin.left)
        measure(element, "--video-y", box.top - origin.top)
        measure(element, "--video-w", box.width)
        measure(element, "--video-h", box.height)
      }
      if (next !== before) element.dataset.form = next
      const away = slide(next === "pinned" && !playing && !!box && box.top < 0)
      element.toggleAttribute("data-away", away)
      measure(root, "--video-cover", coverOf(next, away, box?.height ?? 0))
      // Also while the room says why its video does not play.
      root.toggleAttribute("data-room", next === "pinned" || (next !== "mini" && !!room && room.bottom > BAR))
      setForm(next)
    }
    const update = () => lay.current()
    const sizes = new ResizeObserver(update)
    const settle = () => {
      sizes.disconnect()
      const place = placeNow()
      if (place) for (const part of [place.box, document.body]) sizes.observe(part)
      update()
    }
    settle()
    const stop = onPlace(settle)
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      stop()
      sizes.disconnect()
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
      root.removeAttribute("data-room")
      root.style.removeProperty("--video-cover")
    }
  }, [frame, wide])

  // Also once the page that brought the place has scrolled to where it opens, which comes after its parts have settled.
  useLayoutEffect(() => lay.current(), [spot, seriesId, player])

  return form
}

/**
 * The turns of the match, said once to a reader of the screen: a game begins or ends, something is about to be skipped,
 * the video does not play. It stands beside every page, as the small player does.
 */
function VideoStatus() {
  const [said, setSaid] = useState("")
  useEffect(() => {
    let before = watch.view()
    return watch.subscribe(() => {
      const after = watch.view()
      const words = statusWords(before, after, streamText)
      before = after
      if (words != null) setSaid(words)
    })
  }, [])
  return (
    <p className="sr-only" role="status">
      {said}
    </p>
  )
}

/**
 * The video of the match that is open, beside every page. Its player is made once in the host, which React leaves
 * alone, and goes on while the pages change: over its place in the room, stuck to the top of a narrow window, small in
 * a corner, or parked out of sight.
 */
export function VideoFrame(): ReactNode {
  const { text } = useStreamLocale()
  const wide = usePageLayout() === "wide"
  const frame = useRef<HTMLDivElement>(null)
  const host = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => watch.attach(host.current!), [])

  const spot = useSyncExternalStore(onPlace, placeNow)
  const form = useVideoForm(frame, wide, spot)
  useWatchKeys(form)

  const seriesId = useWatch((view) => view.match?.seriesId)
  const player = useWatch((view) => view.player)
  // With every step the player takes, as one that is paused before it has begun may begin all the same. A page that
  // takes the place of another has its own place by now.
  useEffect(() => {
    if (playsUnseen({ wide, here: placeNow()?.seriesId === seriesId, player })) watch.pause()
  }, [wide, player, seriesId, spot])

  const mini = form === "mini"
  return (
    <>
      <div
        ref={frame}
        className="hub-video"
        data-form="none"
        role={mini ? "region" : undefined}
        aria-label={mini ? text("Video thu nhỏ", "Small player") : undefined}
      >
        <div className="hub-video-box">
          <div ref={host} className="hub-video-host" />
          {(form === "room" || form === "pinned") && <ObjectiveCall />}
        </div>
        {mini && <VideoMini />}
        {(form === "room" || form === "pinned") && (
          <button type="button" className="hub-video-back tn-night" onClick={() => enterRoom()}>
            {text("Về phần theo dõi", "Back to the match")}
          </button>
        )}
      </div>
      <VideoStatus />
    </>
  )
}
