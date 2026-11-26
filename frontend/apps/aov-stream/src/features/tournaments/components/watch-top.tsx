import { Link } from "react-router"
import type { RoomFacts } from "./watch-facts"
import { RoomClose, RoomEnds, RoomShrink } from "./watch-icon"
import "./watch-top.css"

/** The way up from the room, what match it is, and out of it. */
export function WatchTop({ facts: { up, round, bestOf } }: { facts: RoomFacts }) {
  return (
    <div className="tn-room-top">
      <p>
        <Link to={up.to} title={up.name}>
          {up.mark}
          <span>{round ?? up.short ?? up.name}</span>
        </Link>
        <span>BO{bestOf}</span>
      </p>
      <RoomEnds>
        <RoomShrink />
        <RoomClose />
      </RoomEnds>
    </div>
  )
}
