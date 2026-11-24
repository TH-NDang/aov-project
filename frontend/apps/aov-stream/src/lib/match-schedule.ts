import type { CompetitionSlot } from "@aov/community-contracts"
import { calendarDaysBetween, dayKeyInZone, formatInZone } from "@aov/ui/lib/time-zone"
import { matchRoundLabel, matchUnderway, matchWinner } from "./competition-model.ts"
import { matchState, type CompetitionMatch } from "./match-model.ts"
import { foldSearchText } from "@aov/ui/lib/search-text"

export type ScheduleScope = "all" | "upcoming" | "results"

const startOf = (entry: CompetitionMatch) => Date.parse(entry.match.scheduledAt || "")

/**
 * A schedule in reading order. `upcoming` holds what is on now, then what comes next soonest first, then the matches
 * still waiting for a date. `results` holds everything already played, newest first; a match whose result was never
 * entered stays at its date, and one without a date closes the list.
 */
export function scheduleParts(entries: CompetitionMatch[], now = Date.now()) {
  const live: CompetitionMatch[] = []
  const ahead: CompetitionMatch[] = []
  const open: CompetitionMatch[] = []
  const played: CompetitionMatch[] = []
  for (const entry of entries) {
    const state = matchState(entry, now)
    if (state === "UPCOMING") ahead.push(entry)
    else if (state === "UNSCHEDULED") open.push(entry)
    else if (matchUnderway(entry, now)) live.push(entry)
    else played.push(entry)
  }
  const soonest = (a: CompetitionMatch, b: CompetitionMatch) => startOf(a) - startOf(b)
  const newest = (a: CompetitionMatch, b: CompetitionMatch) => {
    const [first, second] = [startOf(a), startOf(b)]
    if (Number.isNaN(first) || Number.isNaN(second)) return Number(Number.isNaN(first)) - Number(Number.isNaN(second))
    return second - first
  }
  return { upcoming: [...live.sort(soonest), ...ahead.sort(soonest), ...open], results: played.sort(newest) }
}

export type ScheduleGroup = {
  /** "live", "open" for matches without a date, otherwise the day as yyyy-mm-dd in the reader's zone. */
  key: string
  /** The start of the first match of a dated group, to write the day from. */
  at: number | null
  items: CompetitionMatch[]
}

/**
 * Neighbouring matches of an ordered schedule gathered under one heading: the matches on now, then one group per day
 * in `timeZone`, and the matches without a date. The order of `entries` is kept.
 */
export function scheduleGroups(entries: CompetitionMatch[], timeZone: string, now = Date.now()): ScheduleGroup[] {
  const groups: ScheduleGroup[] = []
  for (const entry of entries) {
    const at = startOf(entry)
    const dated = !Number.isNaN(at)
    const key = matchUnderway(entry, now) ? "live" : dated ? dayKeyInZone(at, timeZone) : "open"
    const last = groups.at(-1)
    if (last?.key === key) last.items.push(entry)
    else groups.push({ key, at: dated && key !== "live" ? at : null, items: [entry] })
  }
  return groups
}

/** The day a match falls on for the reader, as an address carries it; "unscheduled" while it has no date. */
export function scheduleDay(entry: CompetitionMatch, timeZone: string) {
  return dayKeyInZone(entry.match.scheduledAt, timeZone) || "unscheduled"
}

/**
 * A day taken from an address, kept only when a match falls on it. A day picked in another zone, or copied from a
 * shared link, may not exist in the reader's zone; then nothing is filtered.
 */
export function knownScheduleDay(entries: CompetitionMatch[], timeZone: string, day: string | null) {
  return day && entries.some((entry) => scheduleDay(entry, timeZone) === day) ? day : ""
}

/** The words a reader uses for the days next to today, in Vietnamese and in English. */
const NEAR_DAYS = {
  yesterday: ["Hôm qua", "Yesterday"],
  today: ["Hôm nay", "Today"],
  tomorrow: ["Ngày mai", "Tomorrow"],
} as const

/** A day written for a heading in `locale`, with the word a reader uses for the days next to today. */
export function dayHeading(at: number, timeZone: string, now = Date.now(), locale = "vi-VN") {
  const away = calendarDaysBetween(now, at, timeZone)
  const near = away === 0 ? NEAR_DAYS.today : away === 1 ? NEAR_DAYS.tomorrow : away === -1 ? NEAR_DAYS.yesterday : null
  return {
    near: near && near[locale.startsWith("en") ? 1 : 0],
    date: formatInZone(at, timeZone, { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }, locale),
  }
}

export type MatchSide = {
  side: "a" | "b"
  teamId: string | null
  /** The short name where the team has one; a slot still open says how it will be filled. */
  name: string
  fullName: string
  logoUrl?: string
  logoDarkUrl?: string | null
  /** False while the slot waits for a seed or for the result of another match. */
  known: boolean
  score: number | null
  won: boolean
  lost: boolean
}

/** Names of a slot still open, in Vietnamese and in English. */
const OPEN_SLOT = {
  team: ["Đội chưa có thông tin", "No team information yet"],
  undecided: ["Chờ xác định", "TBD"],
} as const

/** How an open slot will be filled, named after the round of the match that feeds it rather than its key. */
function slotName(entry: CompetitionMatch, slot: CompetitionSlot, english: boolean) {
  if (slot.type === "TEAM") return OPEN_SLOT.team[english ? 1 : 0]
  if (slot.type === "SEED" && slot.seed != null) return english ? `Seed ${slot.seed}` : `Hạt giống ${slot.seed}`
  if (slot.type === "WINNER" || slot.type === "LOSER") {
    const { matches, stages } = entry.competition.content.plan
    const source = matches.find((match) => match.key === slot.matchKey)
    const round =
      source &&
      (matchRoundLabel(
        source,
        stages.find((stage) => stage.code === source.stageCode),
        english ? "en-US" : "vi-VN",
      ) ??
        source.label)
    const outcome = slot.type === "WINNER" ? (english ? "Winner of" : "Thắng") : english ? "Loser of" : "Thua"
    if (round) return `${outcome} ${round}`
    return english ? `${outcome} the previous match` : `${outcome} trận trước`
  }
  return slot.label || OPEN_SLOT.undecided[english ? 1 : 0]
}

/**
 * Both sides of a match as a row shows them: the resolved team, its score and whether it won. An open slot is named
 * in `locale`.
 */
export function matchSides(entry: CompetitionMatch, locale = "vi-VN"): [MatchSide, MatchSide] {
  const { match, result, competition } = entry
  const english = locale.startsWith("en")
  const winner = matchWinner(entry)
  const side = (key: "a" | "b"): MatchSide => {
    const teamId = (key === "a" ? result?.teamAId : result?.teamBId) || match[key].teamId || null
    const team = teamId ? competition.content.teams[teamId] : undefined
    return {
      side: key,
      teamId,
      name: team?.shortName || team?.name || slotName(entry, match[key], english),
      fullName: team?.name || slotName(entry, match[key], english),
      logoUrl: team?.logoUrl,
      logoDarkUrl: team?.logoDarkUrl,
      known: !!team,
      score: (key === "a" ? result?.scoreA : result?.scoreB) ?? null,
      won: winner === key,
      lost: winner != null && winner !== key,
    }
  }
  return [side("a"), side("b")]
}

/** What a match says about its round, in `locale`: the label worth showing, or the name of its stage. */
export function matchRound(entry: CompetitionMatch, locale = "vi-VN") {
  const stage = entry.competition.content.plan.stages.find((item) => item.code === entry.match.stageCode)
  return matchRoundLabel(entry.match, stage, locale) ?? stage?.name ?? null
}

/** Everything a reader may type to find a match: both teams, the competition and who runs it. */
export function matchSearchKey(entry: CompetitionMatch) {
  const { tournament, plan, teams } = entry.competition.content
  const names = matchSides(entry).flatMap((side) => {
    const team = side.teamId ? teams[side.teamId] : undefined
    return team ? [team.name, team.shortName, ...(team.aliases ?? [])] : []
  })
  return foldSearchText([...names, tournament.name, plan.circuit, plan.organizer].filter(Boolean).join(" "))
}
