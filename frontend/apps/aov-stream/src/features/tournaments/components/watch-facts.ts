import type { ReactNode } from "react"
import type { Place } from "../../../components/place-trail"
import type { NamedPlayer } from "../../../lib/crew-model"
import type { RoomNext } from "../../../lib/watch-match"
import type { Score } from "../../../lib/watch-types"

/** What a room says of its match beside what the video tells. */
export type RoomFacts = {
  /** The page above, with the mark of the competition. */
  up: Place
  round: ReactNode
  bestOf: number
  /** The result that is recorded, whatever the video has told of it. */
  score: Score | null
  mvp: NamedPlayer | null
  next: RoomNext | null
}
