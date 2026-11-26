import { flushSync } from "react-dom"
import { Link, useLocation, useNavigate } from "react-router"
import { countWords, placeWords, scoreWords, shortName } from "../lib/watch-words"
import type { WatchView } from "../lib/watch-store"
import { StreamIcon } from "./stream-icon"
import { streamText, useStreamLocale } from "./stream-locale"
import { useWatch } from "./use-watch"
import { enterRoom, placeNow } from "./video-place"
import { watch } from "./watch-session"
import "./video-mini.css"

/** What a link to the page of a match says, so that the page opens its room. */
const TO_ROOM = { room: true }

/** The way from the small player back to the room: on the page of the match itself, or by going there. */
export function useWayBack() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return () => {
    const { match } = watch.view()
    if (!match) return
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (placeNow()?.seriesId === match.seriesId) enterRoom(calm ? "instant" : "smooth")
    else if (pathname === match.href) watch.expand()
    else void navigate(match.href, { state: TO_ROOM })
  }
}

const headFoot = () => document.querySelector("[data-place-head]")?.getBoundingClientRect().bottom

/** Ends the video. What is read stays in its place when the room far above it gives way to the head of the match. */
function end() {
  const before = headFoot()
  flushSync(() => watch.close())
  const after = headFoot()
  if (before != null && after != null && before < 0) window.scrollBy(0, after - before)
  document.getElementById("main")?.focus({ preventScroll: true })
}

/** How the match stands, as far as the video has told it. */
function standing({ match, place }: WatchView) {
  if (!match) return ""
  if (place && place.state !== "UNKNOWN") return scoreWords(match, place)
  return `${shortName(match, "A")} – ${shortName(match, "B")}`
}

/** Where the video is, or that it is on now. */
function whereabouts(view: WatchView) {
  return view.match?.live && !view.place ? streamText("Trực tiếp", "Live") : placeWords(view, streamText, false)
}

/** The row of the small player: how the match stands, or what is about to be skipped, and the way back to the room. */
export function VideoMini() {
  const { text } = useStreamLocale()
  const { pathname } = useLocation()
  const back = useWayBack()
  const href = useWatch((view) => view.match?.href)
  const score = useWatch(standing)
  const where = useWatch(whereabouts)
  const count = useWatch((view) => view.place && view.count && countWords(view.place, view.count, streamText))
  const keys = useWatch((view) => view.keys)
  if (!href) return null

  const row = (
    <>
      <StreamIcon name="expand" size={18} />
      <span className="sr-only">{text("Về phòng xem: ", "Back to the room: ")}</span>
      <b>{count || score}</b>
      {!count && where && <small>{where}</small>}
    </>
  )
  const title = text("Về phòng xem", "Back to the room") + (keys ? " (T)" : "")
  const close = text("Đóng video", "Close the video")
  return (
    <div className="hub-mini tn-night">
      <p className="hub-mini-back">
        {pathname === href ? (
          <button type="button" title={title} onClick={back}>
            {row}
          </button>
        ) : (
          <Link to={href} state={TO_ROOM} title={title}>
            {row}
          </Link>
        )}
      </p>
      {count && (
        <button type="button" className="hub-mini-stay" onClick={() => watch.stay()}>
          {text("Ở lại", "Stay")}
        </button>
      )}
      <button type="button" className="hub-mini-close" title={close} aria-label={close} onClick={end}>
        <StreamIcon name="close" size={18} />
      </button>
    </div>
  )
}
