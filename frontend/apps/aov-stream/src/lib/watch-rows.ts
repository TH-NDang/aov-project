import type { TimelineEvent } from "@aov/community-contracts"
import { kindOf, lastOf, leadIn } from "./watch-story.ts"
import type { Chapter, MomentKind, MomentRow, TimedChapter, WatchTurn } from "./watch-types.ts"

/**
 * How many seconds before a moment or a turn a press plays from: a tower falls ten to thirty-five seconds after the
 * fight that took it.
 */
export const LEADS = {
  TURRET: 25,
  BASE: 25,
  DARK_SLAYER: 12,
  ABYSSAL_DRAGON: 12,
  OTHER: 12,
  KILL: 8,
  NOTE: 10,
  TURN: 5,
  END: 46,
} as const satisfies Record<MomentKind | "TURN" | "END", number>

export function leadOf(kind: MomentKind): number {
  return LEADS[kind]
}

/** Moments of one team this many seconds apart are one row. */
export const ROW_GAP = 25

/** The moments of a game as rows: what one team did in a row. */
export function rowsOf(chapter: Chapter): MomentRow[] {
  const rows: MomentRow[] = []
  for (const { at, second, team, kind, count, title } of chapter.moments) {
    const row = rows.at(-1)
    const note = kind === "NOTE" || row?.taken[0].kind === "NOTE"
    if (row && team && row.team === team && !note && at - row.to <= ROW_GAP) {
      row.to = at
      const same = row.taken.find((item) => item.kind === kind)
      if (same) same.count += count
      else row.taken.push({ kind, count })
      continue
    }
    rows.push({
      from: at,
      to: at,
      team,
      title: kind === "NOTE" ? title : null,
      taken: [{ kind, count }],
      second: second == null ? null : Math.max(chapter.zero ?? 0, second - leadOf(kind)),
    })
  }
  return rows
}

/** The second a press on a turn of the draft plays from; a turn nobody timed plays from the one before it that is. */
export function turnStart(chapter: Chapter, turn: WatchTurn): number | null {
  if (chapter.draftStart == null) return null
  const before = lastOf(chapter.turns, (other) => other.own && other.order < turn.order)
  const second = turn.own ? turn.second! - LEADS.TURN : (before?.second ?? chapter.draftStart)
  return Math.max(leadIn(chapter.draftStart), second)
}

/** The second of its game a moment is watched from. */
export const momentAt = (event: Pick<TimelineEvent, "kind" | "objective" | "atSeconds">) =>
  Math.max(0, event.atSeconds - leadOf(kindOf(event)))

/** The second of its game a turn of the draft is watched from, which is before 0:00; null where nobody timed it. */
export function turnAt(chapter: TimedChapter, order: number): number | null {
  const turn = chapter.turns.find((other) => other.order === order)
  const second = turn?.own ? turnStart(chapter, turn) : null
  return second != null && second < chapter.zero ? second - chapter.zero : null
}
