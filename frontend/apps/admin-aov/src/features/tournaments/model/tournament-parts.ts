import type { TournamentContent, TournamentPart } from "@aov/community-contracts"
import { calendarDaysBetween, currentTimeZone } from "@aov/ui/lib/time-zone"
import { nameKey } from "@/features/esports/model/name-key"

/**
 * A main event and the tournaments that are parts of it: its qualifiers, wildcard, weekly stops or show matches. Each
 * part is a tournament of its own with teams, a format and a final table; the main event is what a list shows.
 */
export type EventFamily = {
  mainEventId: string
  /** Missing while the main event of an open part is still loading. */
  mainName?: string
  /** True when the tournament on screen is a part, false when it is the main event itself. */
  isPart: boolean
  parts: TournamentPart[]
}

const LEADING_SEPARATORS = /^[\s\-–—:·|/,]+/
const SEPARATOR_WORD = /^[\-–—:·|/,]+$|[:,]$/
const WORD_CHARACTER = /[\p{L}\p{N}]/u

/**
 * A part's name as a tab of its main event shows it: what is left once the main event's name is taken off the front,
 * so "Premier League 2026 - Wildcard" reads "Wildcard". When the two only open with the same words up to a separator,
 * those go instead ("City Cup 2021 - Finals" and "City Cup 2021 - Central Region"). A part named on its own keeps its
 * whole name.
 */
export function partLabel(partName: string, mainName: string | undefined) {
  const part = partName.trim()
  const main = (mainName ?? "").trim()
  if (!main) return part

  const boundary = part.charAt(main.length)
  if (part.toLocaleLowerCase().startsWith(main.toLocaleLowerCase()) && !WORD_CHARACTER.test(boundary)) {
    const rest = part.slice(main.length).replace(LEADING_SEPARATORS, "").trim()
    if (rest) return rest
  }

  const partWords = part.split(/\s+/)
  const mainWords = main.split(/\s+/)
  let shared = 0
  while (
    shared < partWords.length &&
    shared < mainWords.length &&
    partWords[shared].toLocaleLowerCase() === mainWords[shared].toLocaleLowerCase()
  )
    shared++
  // The shared opening must end where the names put a separator: "Season 1" and "Season 10 Finals" share three words
  // and are still two different events.
  if (shared >= 3 && shared < partWords.length && SEPARATOR_WORD.test(partWords[shared - 1])) {
    const rest = partWords.slice(shared).join(" ").replace(LEADING_SEPARATORS, "").trim()
    if (rest) return rest
  }
  return part
}

export type PartPhase = "ongoing" | "upcoming" | "finished" | "unscheduled"

/** Where a part stands against today. Dates decide; the status only speaks when there are none or it says "finished". */
export function partPhase(
  part: Pick<TournamentPart, "startsOn" | "endsOn" | "status">,
  now = new Date(),
  timeZone = currentTimeZone(),
): PartPhase {
  const { startsOn, endsOn, status } = part
  if (!startsOn && !endsOn) {
    if (status === "ONGOING") return "ongoing"
    if (status === "UPCOMING" || status === "ANNOUNCED") return "upcoming"
    return status === "FINISHED" ? "finished" : "unscheduled"
  }
  if (startsOn && calendarDaysBetween(now, startsOn, timeZone) > 0) return "upcoming"
  const lastDay = endsOn ?? startsOn
  if (status === "FINISHED" || (lastDay && calendarDaysBetween(now, lastDay, timeZone) < 0)) return "finished"
  return "ongoing"
}

/** Every main event's parts, in the order the server lists them (by start date). */
export function partsByMainEvent(parts: readonly TournamentPart[]) {
  const grouped = new Map<string, TournamentPart[]>()
  for (const part of parts) grouped.set(part.parentId, [...(grouped.get(part.parentId) ?? []), part])
  return grouped
}

const PHASE_ORDER: Record<PartPhase, number> = { ongoing: 0, upcoming: 1, finished: 2, unscheduled: 2 }

/**
 * The parts a list line has room for: the ones a search names come first, then what is in progress or about to start,
 * then the rest in playing order. `hidden` counts the parts left out.
 */
export function partsOnLine(parts: readonly TournamentPart[], search = "", limit = 4, now = new Date()) {
  const wanted = nameKey(search)
  const ranked = parts
    .map((part, index) => ({
      part,
      index,
      named: !!wanted && nameKey(part.name).includes(wanted),
      phase: partPhase(part, now),
    }))
    .sort(
      (a, b) => Number(b.named) - Number(a.named) || PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] || a.index - b.index,
    )
  return { shown: ranked.slice(0, limit), hidden: Math.max(0, ranked.length - limit) }
}

/** What a new part takes from its main event: the same region, year, tier and logos, with the event's name to extend. */
export const partDefaults = (
  mainEventId: string,
  main: Pick<TournamentContent, "name" | "region" | "year" | "tier" | "logoUrl" | "logoDarkUrl">,
): Record<string, string> => ({
  parentTournamentId: mainEventId,
  name: `${main.name} - `,
  region: main.region,
  competitionType: "QUALIFIER",
  ...(main.year ? { year: String(main.year) } : {}),
  ...(main.tier ? { tier: main.tier } : {}),
  ...(main.logoUrl ? { logoUrl: main.logoUrl } : {}),
  ...(main.logoDarkUrl ? { logoDarkUrl: main.logoDarkUrl } : {}),
})
