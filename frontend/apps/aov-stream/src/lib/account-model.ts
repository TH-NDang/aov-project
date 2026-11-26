import { calendarDaysBetween, type TimeValue } from "@aov/ui/lib/time-zone"

/** Which part of the inbox a notification falls in, by the reader's own calendar. */
export type InboxDay = "today" | "yesterday" | "earlier"

/**
 * The inbox cut into today, yesterday and earlier as the reader's time zone counts days. The order of the lines is
 * kept, so a day that comes back later in the list starts a part of its own instead of pulling lines forward.
 */
export function inboxDays<T extends { createdAt: string }>(items: readonly T[], now: TimeValue, timeZone: string) {
  const parts: { day: InboxDay; items: T[] }[] = []
  for (const item of items) {
    const days = calendarDaysBetween(item.createdAt, now, timeZone)
    const day: InboxDay = days <= 0 ? "today" : days === 1 ? "yesterday" : "earlier"
    const last = parts.at(-1)
    if (last?.day === day) last.items.push(item)
    else parts.push({ day, items: [item] })
  }
  return parts
}

/** The month and year an account was made, such as "March 2026" in English; nothing for an unknown or broken date. */
export function memberSince(createdAt: string | null | undefined, locale: string, timeZone: string) {
  const date = createdAt ? new Date(createdAt) : null
  if (!date || Number.isNaN(date.getTime())) return null
  try {
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone }).format(date)
  } catch {
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date)
  }
}
