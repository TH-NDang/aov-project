import { dayKeyInZone, isCalendarDate } from "@aov/ui/lib/time-zone"

/** Day and month as the home list writes them; vi-VN would join these two parts with a dash. */
export function patchDayLabel(value: string, timeZone: string) {
  const day = isCalendarDate(value) ? value : dayKeyInZone(value, timeZone)
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`
}
