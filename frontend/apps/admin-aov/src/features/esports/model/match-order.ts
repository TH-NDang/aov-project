import { dayKeyInZone } from "@aov/ui/lib/time-zone"
import { bySchedule, type SeriesRecord } from "./competition"

/** Where a match stands among its tournament's matches in time order; unscheduled matches come last. */
export function matchNeighbours<T extends SeriesRecord>(records: readonly T[], seriesId: string) {
  const ordered = [...records].sort(bySchedule)
  const index = ordered.findIndex((record) => record.id === seriesId)
  return {
    position: index + 1,
    total: ordered.length,
    previous: index > 0 ? ordered[index - 1]! : null,
    next: index >= 0 ? (ordered[index + 1] ?? null) : null,
  }
}

export type MatchDay<T> = { day: string | null; records: T[] }

/** Matches in time order under the day they are played on in a zone; those without a time are the last group. */
export function matchDays<T extends SeriesRecord>(records: readonly T[], timeZone: string): MatchDay<T>[] {
  const days: MatchDay<T>[] = []
  for (const record of [...records].sort(bySchedule)) {
    const { scheduledAt } = record.content
    const day = scheduledAt ? dayKeyInZone(scheduledAt, timeZone) : null
    const last = days.at(-1)
    if (last && last.day === day) last.records.push(record)
    else days.push({ day, records: [record] })
  }
  return days
}
