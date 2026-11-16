import {
  currentTimeZone,
  DATE_TIME_FORMAT,
  formatCalendarDate,
  formatInZone,
  isCalendarDate,
} from "@aov/ui/lib/time-zone"

/**
 * A schedule date as text, for labels and tooltips that cannot hold `LocalTime`. A calendar date stays as written, a
 * moment reads in the reader's zone, and both follow the reader's date format.
 */
export function dateLabel(value: string | null | undefined, locale = "vi-VN") {
  if (!value) return "—"
  if (isCalendarDate(value)) return formatCalendarDate(value, undefined, locale)
  return formatInZone(value, currentTimeZone(), DATE_TIME_FORMAT, locale) || "—"
}

export function scheduleDate(date: string, time: string) {
  if (!date) throw new Error("A calendar date is required.")
  return time ? { at: new Date(`${date}T${time}`).toISOString(), on: null } : { at: null, on: date }
}

export function parseScheduleDate(text: string): Date | undefined {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim())
  if (!match) return undefined
  const [, day, month, year] = match.map(Number)
  if (year! < 2000 || year! > 2100) return undefined
  const date = new Date(year!, month! - 1, day)
  return date.getFullYear() === year && date.getMonth() === month! - 1 && date.getDate() === day ? date : undefined
}

export function scheduleDateText(date: Date | undefined) {
  return date
    ? `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`
    : ""
}
