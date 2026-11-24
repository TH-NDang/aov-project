import { dayKeyInZone } from "@aov/ui/lib/time-zone"
import { matchUnderway } from "./competition-model.ts"
import type { CompetitionMatch } from "./match-model.ts"

export type ScheduleDayMark = {
  /** yyyy-mm-dd in the reader's zone. */
  day: string
  /** The start of its first match, to write the day from. */
  at: number
  count: number
  live: boolean
}

/**
 * The days a schedule has matches on, in time order, with how many fall on each. A long schedule keeps the days
 * nearest to now: `size` of them, with `back` days before today at most once later ones could take their place.
 */
export function scheduleDayMarks(
  entries: CompetitionMatch[],
  timeZone: string,
  now = Date.now(),
  size = 30,
  back = 10,
): ScheduleDayMark[] {
  const days = new Map<string, ScheduleDayMark>()
  for (const entry of entries) {
    const at = Date.parse(entry.match.scheduledAt || "")
    if (Number.isNaN(at)) continue
    const day = dayKeyInZone(at, timeZone)
    const mark = days.get(day)
    const live = matchUnderway(entry, now)
    if (!mark) days.set(day, { day, at, count: 1, live })
    else {
      mark.at = Math.min(mark.at, at)
      mark.count += 1
      mark.live ||= live
    }
  }
  const marks = [...days.values()].sort((a, b) => a.at - b.at)
  if (marks.length <= size) return marks
  const today = dayKeyInZone(now, timeZone)
  const ahead = marks.filter((mark) => mark.day >= today).length
  const last = marks.length - Math.max(0, ahead - (size - back))
  return marks.slice(Math.max(0, last - size), last)
}
