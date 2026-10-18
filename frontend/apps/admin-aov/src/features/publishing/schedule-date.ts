export function dateLabel(value: string | null | undefined, locale = "vi-VN") {
  if (!value) return "—"
  if (/^\d{4}-\d{2}-\d{2}$/.test(value))
    return new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, { dateStyle: "medium", timeZone: "UTC" })
  return new Date(value).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })
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
