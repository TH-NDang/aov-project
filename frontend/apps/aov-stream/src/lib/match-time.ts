import { calendarDaysBetween, formatCalendarDate, formatInZone } from "@aov/ui/lib/time-zone"

/**
 * A day and a month without the year. Vietnamese data puts a dash between them in this form alone; they read with a
 * slash like every other date.
 */
const slashed = (day: string, locale: string) =>
  locale.startsWith("vi") ? day.replace(/^(\d{1,2})-(\d{1,2})$/, "$1/$2") : day

export const dayMonth = (day: string, locale = "vi-VN") =>
  slashed(formatCalendarDate(day, { day: "2-digit", month: "2-digit" }, locale), locale)

export const dayMonthInZone = (at: number, timeZone: string, locale = "vi-VN") =>
  slashed(formatInZone(at, timeZone, { day: "2-digit", month: "2-digit" }, locale), locale)

const NEAR = {
  "-1": ["Hôm qua", "Yesterday"],
  "0": ["Hôm nay", "Today"],
  "1": ["Ngày mai", "Tomorrow"],
} as const

/**
 * When a match starts, in the fewest words that place it: the day by name when it is next to today, the weekday and
 * the date otherwise, and the year only when it is another one.
 */
export function matchTimeText(at: number, timeZone: string, now: number, locale = "vi-VN") {
  const english = locale.startsWith("en")
  const clock = formatInZone(at, timeZone, { hour: "2-digit", minute: "2-digit" }, locale)
  const near = NEAR[String(calendarDaysBetween(now, at, timeZone)) as keyof typeof NEAR]
  if (near) return `${clock} ${(english ? near[1] : near[0]).toLocaleLowerCase(locale)}`
  const year = (value: number) => formatInZone(value, timeZone, { year: "numeric" }, locale)
  const day = formatInZone(
    at,
    timeZone,
    year(at) === year(now)
      ? { weekday: "short", day: "2-digit", month: "2-digit" }
      : { day: "2-digit", month: "2-digit", year: "numeric" },
    locale,
  )
  return `${clock} ${day}`
}
