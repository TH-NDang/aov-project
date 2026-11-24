import type { TournamentContent, TournamentStatus } from "@aov/community-contracts"
import { calendarDaysBetween, currentTimeZone } from "@aov/ui/lib/time-zone"

export const STATUS_ORDER: TournamentStatus[] = ["ANNOUNCED", "UPCOMING", "ONGOING", "FINISHED", "UNKNOWN"]

type Dates = Pick<TournamentContent, "startsOn" | "endsOn">

/** The status a tournament has by its dates alone; one without dates was only announced. */
export function statusFromDates(
  { startsOn, endsOn }: Dates,
  now = new Date(),
  timeZone = currentTimeZone(),
): TournamentStatus {
  if (endsOn && calendarDaysBetween(now, endsOn, timeZone) < 0) return "FINISHED"
  if (startsOn) return calendarDaysBetween(now, startsOn, timeZone) > 0 ? "UPCOMING" : "ONGOING"
  return "ANNOUNCED"
}

/** A status its own dates contradict: what the dates say, and why. */
export type StatusConflict = { status: TournamentStatus; reason: string }

/**
 * The contradiction between a status and the dates, or null. An unknown status claims nothing, and one that says
 * "finished" before the last day may be right: a final can be played early.
 */
export function statusConflict(
  content: Dates & Pick<TournamentContent, "status">,
  now = new Date(),
  timeZone = currentTimeZone(),
): StatusConflict | null {
  const { startsOn, endsOn, status } = content
  if (!status || status === "UNKNOWN") return null

  const untilStart = startsOn ? calendarDaysBetween(now, startsOn, timeZone) : null
  const untilEnd = endsOn ? calendarDaysBetween(now, endsOn, timeZone) : null
  if (untilEnd !== null && untilEnd < 0)
    return status === "FINISHED" ? null : { status: "FINISHED", reason: `Lịch đã hết ${-untilEnd} ngày` }
  if (untilStart === null) return null
  if (untilStart > 0)
    return status === "ONGOING" || status === "FINISHED"
      ? { status: "UPCOMING", reason: `Lịch còn ${untilStart} ngày mới bắt đầu` }
      : null
  if (status !== "UPCOMING" && status !== "ANNOUNCED") return null
  return { status: "ONGOING", reason: untilStart ? `Lịch đã bắt đầu ${-untilStart} ngày` : "Lịch bắt đầu hôm nay" }
}
