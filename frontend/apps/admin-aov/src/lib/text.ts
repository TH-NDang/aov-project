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

/** The reader's locale, from the browser, for interface numbers such as counts, views and statistics. */
export const readerLocale = () => (typeof navigator === "undefined" ? undefined : navigator.language) || undefined

const numberFormats = new Map<string, Intl.NumberFormat>()

/**
 * An interface number (row counts, views, statistics) in the reader's locale. Figures of the game (health, gold,
 * seconds) are written as the game writes them with formatGameNumber instead (QUY-UOC-VIET section 3).
 */
export function formatNumber(value: number, options: Intl.NumberFormatOptions = {}, locale = readerLocale()): string {
  const key = JSON.stringify([locale ?? "", options])
  let format = numberFormats.get(key)
  if (!format) {
    format = new Intl.NumberFormat(locale, options)
    numberFormats.set(key, format)
  }
  return format.format(value)
}
