import { memo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Minus, Plus } from "lucide-react"
import { spanLabel, type BroadcastChapter } from "../../../model/broadcast-timeline"
import type { Playhead } from "../../../model/playhead"
import { stripRange, type GameChapter } from "../../../model/series-vod"
import { eventSide, type TimelineEvent } from "../../../model/timeline"
import { usePlayhead } from "../../game/use-playhead"
import { useFollow } from "./use-retime"
import { useStore, type TimelineView } from "./use-timeline-view"

/** Place of a second on the strip, in percent of its length. */
type Place = (second: number) => number
const left = (place: Place, second: number) => ({ left: `${place(second)}%` })
const stretch = (place: Place, from: number, to: number) => ({
  left: `${place(from)}%`,
  width: `${Math.max(0, place(to) - place(from))}%`,
})

function StripPlayhead({ playhead, place }: { playhead: Playhead; place: Place }) {
  const second = usePlayhead(playhead)
  return <span className="esp-strip-now" style={left(place, second)} />
}

/** The part of the video the track shows; left out while it shows all of it. */
function StripWindow({ view, place, duration }: { view: TimelineView; place: Place; duration: number }) {
  const { from, to } = useStore(view.shownNow)
  return to - from < duration - 1 ? <span className="esp-strip-window" style={stretch(place, from, to)} /> : null
}

/** What stands still on the strip: drafts, games with their numbers, moments and the start of the match. */
const StripGames = memo(function StripGames({
  chapters,
  flags,
  events,
  focusedGameId,
  from,
  to,
}: {
  chapters: GameChapter[]
  flags: BroadcastChapter[]
  events: TimelineEvent[]
  focusedGameId: string | null
  from: number
  to: number
}) {
  const place: Place = (second) => ((second - from) / (to - from)) * 100
  const placed = chapters.filter((chapter) => chapter.synced)
  return (
    <>
      {placed.map(({ gameId, draft, start, live }) =>
        draft ? (
          <span
            key={gameId}
            className="esp-strip-draft"
            style={stretch(place, draft.start, draft.locked ?? (live ? start : draft.start + 300))}
          />
        ) : null,
      )}
      {placed.map((chapter) =>
        chapter.live ? (
          <span
            key={chapter.gameId}
            className="esp-strip-game"
            data-focused={chapter.gameId === focusedGameId || undefined}
            style={stretch(place, chapter.start, chapter.end)}
          >
            <span>{chapter.number}</span>
          </span>
        ) : null,
      )}
      {events.map((event) => {
        const side = event.kind === "KILL" || event.kind === "OBJECTIVE" ? eventSide(event) : null
        return side ? (
          <span key={event.id} className="esp-strip-tick" data-side={side} style={left(place, event.at)} />
        ) : null
      })}
      {flags.map((flag) =>
        flag.id === "match-start" ? (
          <span key={flag.id} className="esp-strip-notch" style={left(place, flag.at)} />
        ) : null,
      )}
    </>
  )
})

/** The steps of the span the track shows, and its length, which turns between the phase on screen and the whole video. */
function Zoom({ view, duration }: { view: TimelineView; duration: number }) {
  const label = spanLabel(view.shown, duration)
  const whole = view.shown >= duration
  return (
    <span className="esp-strip-zoom">
      <button
        type="button"
        aria-label="Xem khoảng dài hơn"
        title="Xem khoảng dài hơn"
        disabled={!view.longer}
        onClick={() => view.longer?.()}
      >
        <Minus size={14} />
      </button>
      <button
        type="button"
        className="esp-strip-span"
        aria-label={
          whole
            ? "Khoảng đang xem là cả video, bấm để xem phần đang phát"
            : `Khoảng đang xem ${label}, bấm để xem cả video`
        }
        title={whole ? "Bấm để xem phần đang phát" : "Bấm để xem cả video"}
        onClick={view.toggleWhole}
      >
        {label}
      </button>
      <button
        type="button"
        aria-label="Xem khoảng ngắn hơn"
        title="Xem khoảng ngắn hơn"
        disabled={!view.shorter}
        onClick={() => view.shorter?.()}
      >
        <Plus size={14} />
      </button>
    </span>
  )
}

/**
 * The whole video with its games: a press or a drag goes there, and the part the track shows is outlined. A video that
 * holds a whole day is cut to the match until somebody asks for all of it.
 */
export function Strip({
  playhead,
  duration,
  chapters,
  flags,
  events,
  focusedGameId,
  view,
  onSeek,
}: {
  playhead: Playhead
  duration: number
  chapters: GameChapter[]
  flags: BroadcastChapter[]
  events: TimelineEvent[]
  focusedGameId: string | null
  view: TimelineView
  onSeek: (second: number) => void
}) {
  const bar = useRef<HTMLDivElement>(null)
  const [whole, setWhole] = useState(false)
  const cut = stripRange(chapters, duration)
  const { from, to } = whole ? { from: 0, to: duration } : cut
  const place: Place = (second) => ((second - from) / (to - from)) * 100

  const follow = useFollow(onSeek)
  /** The second last asked for while the pointer is down. */
  const pressed = useRef<number | null>(null)
  const secondAt = (clientX: number) => {
    const rect = bar.current!.getBoundingClientRect()
    const part = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)))
    return Math.round(from + part * (to - from))
  }
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.button ?? 0) !== 0) return
    pressed.current = secondAt(event.clientX)
    follow(pressed.current, true)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Synthetic or already-released pointers cannot be captured; dragging still works inside the strip.
    }
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pressed.current !== null) follow(secondAt(event.clientX))
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const second = secondAt(event.clientX)
    if (pressed.current !== null && pressed.current !== second) follow(second, true)
    pressed.current = null
  }

  return (
    <div className="esp-strip">
      {cut.cut && (
        <button
          type="button"
          className="esp-strip-part"
          aria-label={
            whole
              ? "Thanh đang hiện cả video, bấm để chỉ hiện trận này"
              : "Thanh đang hiện trận này, bấm để hiện cả video"
          }
          onClick={() => setWhole(!whole)}
        >
          {whole ? "Cả video" : "Trận này"}
        </button>
      )}
      <div
        ref={bar}
        className="esp-strip-bar"
        data-strip
        aria-hidden="true"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (pressed.current = null)}
      >
        <StripGames
          chapters={chapters}
          flags={flags}
          events={events}
          focusedGameId={focusedGameId}
          from={from}
          to={to}
        />
        <StripWindow view={view} place={place} duration={duration} />
        <StripPlayhead playhead={playhead} place={place} />
      </div>
      <Zoom view={view} duration={duration} />
    </div>
  )
}
