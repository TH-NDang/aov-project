/** A pause of this many days between two match days starts another week. */
const PAUSE = 3

const DAY = 24 * 60 * 60 * 1000
const dayNumber = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY)

/** The weeks a list of match days (yyyy-mm-dd) falls into, counted from 1, by day. */
export function playWeeks(days: Iterable<string>): Map<string, number> {
  const weeks = new Map<string, number>()
  let week = 0
  let last = Number.NEGATIVE_INFINITY
  for (const day of [...new Set(days)].sort()) {
    const at = dayNumber(day)
    if (at - last >= PAUSE) week += 1
    weeks.set(day, week)
    last = at
  }
  return weeks
}

const WEEKS = /^(?:tuần|match ?weeks?|weeks?)\s*(\d+)(?:\s*[–—-]\s*(\d+))?$/iu

/** The weeks a label names in either language, as "Weeks 2–4" does, or null when it names something else. */
export function labelWeeks(label: string | null | undefined): [from: number, to: number] | null {
  const match = WEEKS.exec(label?.trim() ?? "")
  if (!match) return null
  const from = Number(match[1])
  return [from, match[2] ? Number(match[2]) : from]
}
