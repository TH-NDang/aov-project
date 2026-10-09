/** Lower-cases and strips Vietnamese diacritics so accented and unaccented spellings match. */
export function normalize(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim()
}

/** True when every whitespace-separated term of `query` appears in one of `fields`. */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const haystack = fields.map(normalize).join(" ")
  return terms.every((term) => haystack.includes(term))
}

/** cmdk `filter`: every search term must appear in the item value, ignoring accents. */
export function commandFilter(value: string, search: string): number {
  return matchesQuery(search, value) ? 1 : 0
}

export function slugify(value: string): string {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

const numberFormat = new Intl.NumberFormat("vi-VN")

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

const dateTimeFormat = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" })

export function formatDateTime(value: string | number | Date): string {
  return dateTimeFormat.format(new Date(value))
}

const relativeFormat = new Intl.RelativeTimeFormat("vi-VN", { numeric: "auto" })

export function formatRelative(value: string | number | Date): string {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return relativeFormat.format(seconds, "second")
  if (abs < 3600) return relativeFormat.format(Math.round(seconds / 60), "minute")
  if (abs < 86400) return relativeFormat.format(Math.round(seconds / 3600), "hour")
  return relativeFormat.format(Math.round(seconds / 86400), "day")
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
