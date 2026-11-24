import { calendarDaysBetween, currentTimeZone, dayKeyInZone, isValidTimeZone } from "@aov/ui/lib/time-zone"

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** How long until `at`, in the one or two units a reader can use; null once it passed. */
export function timeUntil(at: number, now: number, locale = "vi-VN"): string | null {
  const left = at - now
  if (!(left > 0)) return null
  const english = locale.startsWith("en")
  const amount = (n: number, vi: string, en: string) => (english ? `${n} ${en}${n === 1 ? "" : "s"}` : `${n} ${vi}`)
  if (left < HOUR) return amount(Math.max(1, Math.round(left / MINUTE)), "phút", "minute")
  if (left >= DAY) return amount(Math.floor(left / DAY), "ngày", "day")
  const hours = Math.floor(left / HOUR)
  const minutes = Math.floor((left - hours * HOUR) / MINUTE)
  return [amount(hours, "giờ", "hour"), minutes > 0 && amount(minutes, "phút", "minute")].filter(Boolean).join(" ")
}

/** Days from today to a calendar date, on the calendar where the event is played; null without a date. */
export function daysUntil(day: string | null | undefined, now: number, timeZone?: string | null) {
  if (!day || Number.isNaN(Date.parse(day.slice(0, 10)))) return null
  const zone = isValidTimeZone(timeZone) ? timeZone : currentTimeZone()
  return calendarDaysBetween(dayKeyInZone(now, zone), day.slice(0, 10), zone)
}
