import type { ReactNode } from "react"
import { formatCalendarDate } from "@aov/ui/lib/time-zone"
import { useStreamLocale } from "../../../components/stream-locale"
import type { ScheduleScope } from "../../../lib/match-schedule"
import { ChoiceTrack } from "./choice-track"

/** Each part of a schedule, with its name in Vietnamese and in English. */
const SCOPES: [ScheduleScope, readonly [string, string]][] = [
  ["all", ["Tất cả", "All"]],
  ["upcoming", ["Lịch đấu", "Schedule"]],
  ["results", ["Kết quả", "Results"]],
]

export function scheduleScope(value: string | null): ScheduleScope {
  return value === "upcoming" || value === "results" ? value : "all"
}

/** How a day picked from an address reads in a sentence, its date written in `locale`. */
export function scheduleDayLabel(day: string, locale: string) {
  const english = locale.startsWith("en")
  if (day === "unscheduled") return english ? "matches without a date" : "các trận chờ xếp lịch"
  const date = formatCalendarDate(day, undefined, locale)
  return english ? date : `ngày ${date}`
}

/** The quick switch between everything, what is ahead and what was played. `className` places it in its bar. */
export function ScheduleScopePills({
  value,
  onChange,
  className,
}: {
  value: ScheduleScope
  onChange: (scope: ScheduleScope) => void
  className?: string
}) {
  const { text } = useStreamLocale()
  return (
    <ChoiceTrack
      label={text("Trạng thái trận đấu", "Match status")}
      size="small"
      className={className}
      value={value}
      choices={SCOPES.map(([key, name]) => ({ key, name: text(...name) }))}
      onChoose={onChange}
    />
  )
}

/** One choice of a filter: its value, its name, the picture that goes with it and how many games it leaves. */
export type FilterOption = readonly [value: string, name: string, mark?: ReactNode, games?: number]
