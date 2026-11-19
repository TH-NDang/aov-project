import type { RetimeTarget } from "../../model/broadcast-timeline"
import { eventSide, type TimelineEvent } from "../../model/timeline"

/** Pill width in pixels; markers closer than this on screen merge into one cluster per row. */
export const PILL_PX = 76

/** Row centres inside the detail track (px): blue kills/items, objectives and notes, red kills/items. */
export const ROW_TOP = { BLUE: 48, MID: 84, RED: 120 } as const

/** The three rows of the detail track; a moment recorded from a row starts as what that row holds. */
export type TimelineRow = keyof typeof ROW_TOP

/** The row a moment is drawn in: objectives and notes in the middle, the rest on the side of its team. */
export const rowOf = (event: TimelineEvent) =>
  event.kind === "OBJECTIVE" || event.kind === "NOTE" ? "MID" : (eventSide(event) ?? "MID")

/** What the track may change, present only while an editor with write access is recording. */
export type TimelineEditing = {
  /** Game whose markers may be moved: the page saves through this game only. */
  gameId: string
  /** False until the game has gone live; moments cannot be recorded before that. */
  canCreate: boolean
  /** Records a moment in a row: at a video second when one was pointed at, otherwise at the playhead. */
  onCreate: (row: TimelineRow, second?: number) => void
  /** Moves one marker to another video second, already inside the range it is allowed in. */
  onRetime: (target: RetimeTarget, second: number) => void
}
