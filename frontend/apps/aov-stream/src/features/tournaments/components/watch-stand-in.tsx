import type { ReactNode } from "react"
import { useStreamLocale } from "../../../components/stream-locale"
import type { RoomShape } from "../../../lib/watch-types"
import { RoomClose, RoomEnds, RoomPress, RoomShrink } from "./watch-icon"
import "./watch-stand-in.css"

/**
 * In the place of what the room holds beside its video: while that is on its way, or with `again` where it could not be
 * loaded. The video plays meanwhile, so it can be closed.
 */
export function WatchStandIn({ shape: { shape, bar }, again }: { shape: RoomShape; again?: () => void }): ReactNode {
  const { text } = useStreamLocale()
  const wayOut = (
    <div key="way-out" className="tn-room-way-out">
      <RoomEnds>
        <RoomShrink />
        <RoomClose />
      </RoomEnds>
    </div>
  )
  const state = again ? (
    <div key="state" className="tn-room-lost" role="alert">
      <p>{text("Chưa tải được phần theo dõi trận", "The match panel could not be loaded")}</p>
      <RoomPress onClick={again}>{text("Thử lại", "Retry")}</RoomPress>
    </div>
  ) : (
    <span
      key="state"
      className="tn-room-wait"
      role="status"
      aria-label={text("Đang tải phần theo dõi trận…", "Loading the match panel…")}
    />
  )
  const companion = (
    <div key="companion" className="tn-room-side tn-room-stand-in">
      {shape === "bare" ? [state, wayOut] : [wayOut, state]}
    </div>
  )
  if (again || shape === "bare") return companion
  const line = <div key="bar" className="tn-room-bar" style={{ height: bar }} />
  return shape === "stack" ? [line, companion] : [companion, line]
}
