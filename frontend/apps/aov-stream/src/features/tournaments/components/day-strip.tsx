import { useEffect, useRef } from "react"
import { calendarDaysBetween, formatInZone, useUserTimeZone } from "@aov/ui/lib/time-zone"
import { useStreamLocale } from "../../../components/stream-locale"
import type { CompetitionMatch } from "../../../lib/match-model"
import { dayMonthInZone } from "../../../lib/match-time"
import { scheduleDayMarks } from "../../../lib/schedule-days"
import { useNow } from "../../../lib/use-now"
import "./day-strip.css"

/**
 * The days with matches as one row that scrolls sideways, today in view. Choosing a day keeps its matches only;
 * choosing it again shows the whole schedule.
 */
export function DayStrip({
  entries,
  value,
  onChange,
}: {
  entries: CompetitionMatch[]
  value: string
  onChange: (day: string) => void
}) {
  const { text, languageTag } = useStreamLocale()
  const timeZone = useUserTimeZone()
  const now = useNow()
  const strip = useRef<HTMLDivElement>(null)
  const marks = scheduleDayMarks(entries, timeZone, now)
  const next = marks.find((mark) => calendarDaysBetween(now, mark.at, timeZone) >= 0)
  const focus = value || next?.day || marks.at(-1)?.day
  useEffect(() => {
    const row = strip.current
    const mark = row?.querySelector<HTMLElement>(`[data-day="${focus}"]`)
    if (row && mark) row.scrollLeft = mark.offsetLeft - (row.clientWidth - mark.offsetWidth) / 2
  }, [focus, marks.length])
  if (marks.length < 2) return null
  return (
    <div ref={strip} className="tn-days" role="group" aria-label={text("Chọn ngày", "Choose a day")}>
      {marks.map((mark) => {
        const away = calendarDaysBetween(now, mark.at, timeZone)
        const matches = text(`${mark.count} trận`, `${mark.count} ${mark.count === 1 ? "match" : "matches"}`)
        return (
          <button
            type="button"
            key={mark.day}
            data-day={mark.day}
            data-past={away < 0 || undefined}
            aria-pressed={value === mark.day}
            onClick={() => onChange(value === mark.day ? "" : mark.day)}
          >
            <span>
              {away === 0
                ? text("Hôm nay", "Today")
                : formatInZone(mark.at, timeZone, { weekday: "short" }, languageTag)}
            </span>
            <b>{dayMonthInZone(mark.at, timeZone, languageTag)}</b>
            <small>{mark.live ? <span className="tn-live">{matches}</span> : matches}</small>
          </button>
        )
      })}
    </div>
  )
}
