import type { WatchPlayerState } from "./watch-store.ts"
import type { RoomShape } from "./watch-types.ts"

/** How the one frame is laid out: parked, in its room, stuck to the window's top, or small in a corner. */
export type VideoForm = "none" | "room" | "pinned" | "mini"

/** The share of the video's place that has to be seen for the video to stay in it. */
export const SEEN_ENOUGH = 0.35

/** The most of the window's height that a video which sticks to its top may take. */
const MOST = 0.75

/**
 * The form the frame takes. Wide, the video goes on small once its place is scrolled away; paused, it scrolls away with
 * the page, though one that is small already stays, and one that was parked comes out only to play. Compact, it sticks
 * to the top of the page of its match, unless that leaves too little of the page to read, and is nowhere else.
 */
export function videoForm({
  open,
  wide,
  here,
  shape,
  seen,
  takes,
  playing,
  before,
}: {
  open: boolean
  wide: boolean
  /** Whether the page holds the place of the match that is open. */
  here: boolean
  shape: RoomShape["shape"] | null
  /** The share of that place that is seen, 0 to 1. */
  seen: number
  /** The share of the window's height that the place takes. */
  takes: number
  playing: boolean
  before: VideoForm
}): VideoForm {
  if (!open) return "none"
  if (!wide) {
    if (!here) return "none"
    return (shape === "stack" || shape === "bare") && takes <= MOST ? "pinned" : "room"
  }
  if (here && (seen >= SEEN_ENOUGH || (!playing && before !== "mini"))) return "room"
  return playing || before !== "none" ? "mini" : "none"
}

/** How much of the window's top the video covers, under which what is scrolled to has to stand. */
export function coverOf(form: VideoForm, away: boolean, height: number): number {
  return form === "pinned" && !away ? height : 0
}

/** The states in which a video is heard, or is about to be. */
const HEARD: readonly WatchPlayerState[] = ["OPENING", "WAITING", "PLAYING"]

/** Whether a video would be heard that nobody sees: a narrow window without its place has no small player for it. */
export function playsUnseen({ wide, here, player }: { wide: boolean; here: boolean; player: WatchPlayerState }) {
  return !wide && !here && HEARD.includes(player)
}
