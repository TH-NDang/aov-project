import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react"
import { OnDemandPart } from "../../../components/on-demand"
import { useStreamLocale } from "../../../components/stream-locale"
import { useWatch } from "../../../components/use-watch"
import { showRoom } from "../../../components/video-place"
import { watch } from "../../../components/watch-session"
import { turnedOver } from "../../../lib/watch-shape"
import type { RoomBar, WatchMatch } from "../../../lib/watch-types"
import { roomInside } from "./room-inside"
import { useRoomShape } from "./use-room-shape"
import type { RoomFacts } from "./watch-facts"
import { WatchScreen } from "./watch-screen"
import { WatchStandIn } from "./watch-stand-in"
import "./watch-room.css"

/** What stands under the video: the story of the match, its games as tabs where nothing is timed, or neither. */
function barKind({ story, live }: WatchMatch, failed: boolean): RoomBar {
  if (!story.chapters.length || (live && story.level !== "TIMED")) return "NONE"
  return failed || story.level === "PLAIN" ? "TABS" : "STORY"
}

/** A phone turned sideways while its video plays shows the room from its top. */
function useTurned(room: RefObject<HTMLElement | null>, width: number, height: number) {
  const before = useRef({ width, height })
  useEffect(() => {
    const was = before.current
    before.current = { width, height }
    const turned = turnedOver(was, { width, height }) && window.matchMedia("(hover: none)").matches
    if (turned && room.current && watch.view().player === "PLAYING") showRoom(room.current)
  }, [room, width, height])
}

/**
 * The room a match is watched in, in the place of its head: the video as large as the window allows, beside it what is
 * happening, and under both the story of the match. The video itself stands in the frame of the app, over its place.
 */
export function WatchRoom({ match, facts }: { match: WatchMatch; facts: RoomFacts }): ReactNode {
  const { text } = useStreamLocale()
  const failed = useWatch((view) => view.failure != null)
  const kind = barKind(match, failed)
  const { width, height, shape } = useRoomShape(kind)
  const room = useRef<HTMLElement>(null)
  useTurned(room, width, height)
  // What was opened over the companion goes with the room, and does not wait for the reader to come back.
  useEffect(() => () => watch.show(null), [])
  // Parts that change places with the shape of the window would come in again.
  const [entering, setEntering] = useState(true)
  const { A, B } = match.teams

  return (
    <section
      ref={room}
      className="tn-room tn-night"
      data-video-room=""
      data-shape={shape.shape}
      data-density={shape.density}
      data-phone={shape.phone || undefined}
      data-entering={entering || undefined}
      onAnimationEnd={() => setEntering(false)}
      tabIndex={-1}
      aria-label={text("Phòng xem", "Watch room")}
      style={
        {
          "--room-w": `${width}px`,
          "--room-video-w": `${shape.video.width}px`,
          "--room-video-h": `${shape.video.height}px`,
          "--room-side-w": `${shape.companion}px`,
        } as CSSProperties
      }
    >
      <h1 className="sr-only">{text(`${A.name} gặp ${B.name}`, `${A.name} vs ${B.name}`)}</h1>
      <button type="button" className="tn-room-stop" onClick={() => watch.focus()}>
        {text("Tới video", "To the video")}
      </button>
      <WatchScreen match={match} />
      <OnDemandPart
        part={roomInside}
        waiting={<WatchStandIn shape={shape} />}
        failed={(again) => <WatchStandIn shape={shape} again={again} />}
      >
        {(Inside) => <Inside match={match} facts={facts} kind={kind} shape={shape} width={width} />}
      </OnDemandPart>
    </section>
  )
}
