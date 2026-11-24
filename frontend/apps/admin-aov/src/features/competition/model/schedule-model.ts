import type {
  CompetitionPlan,
  CompetitionSlot,
  CompetitionSnapshot,
  CompetitionStage,
  DocumentView,
  GameContent,
  PlannedMatch,
  ResolvedMatch,
  SeriesContent,
} from "@aov/community-contracts"
import { dayKeyInZone } from "@aov/ui/lib/time-zone"
import { youtubeVideoId } from "@/features/esports/model/vod"
import {
  hasScore,
  isLeagueStage,
  isWebLink,
  resultProblem,
  zonedInputInstant,
  zonedInputTime,
} from "../workspace/model"

/** What a list of matches is narrowed to. The code travels in the address as `show`. */
export const MATCH_FILTERS = [
  "ALL",
  "NO_SCORE",
  "NO_TIME",
  "NO_VIDEO",
  "GAMES_MISSING",
  "PLAYERS_MISSING",
  "SCORE_DIFFERS",
  "NOT_OPEN",
  "MISMATCH",
  "UNPUBLISHED",
] as const
export type MatchFilter = (typeof MATCH_FILTERS)[number]

export const MATCH_FILTER_LABELS: Record<MatchFilter, string> = {
  ALL: "Tất cả",
  NO_SCORE: "Chưa có tỷ số",
  NO_TIME: "Chưa có giờ",
  NO_VIDEO: "Chưa có video",
  GAMES_MISSING: "Thiếu ván",
  PLAYERS_MISSING: "Ván thiếu tuyển thủ",
  SCORE_DIFFERS: "Tỷ số lệch ván",
  NOT_OPEN: "Chờ mở nhập",
  MISMATCH: "Lệch suất",
  UNPUBLISHED: "Chưa công bố",
}

export const matchFilterOf = (value: string | null): MatchFilter =>
  MATCH_FILTERS.find((filter) => filter === value) ?? "ALL"

export type MatchFacts = {
  match: PlannedMatch
  row?: ResolvedMatch
  series?: DocumentView<SeriesContent>
  games: DocumentView<GameContent>[]
  /** False while the games were not read yet, when none listed does not mean none recorded. */
  gamesKnown: boolean
  /** The score readers see now; undefined while the competition is not published. */
  published?: ResolvedMatch | null
}

/** Games won per side as the recorded games say; null while a game has no winner yet. */
export function scoreFromGames(series: SeriesContent, games: readonly DocumentView<GameContent>[]) {
  if (!games.length) return null
  const score = { a: 0, b: 0 }
  for (const { content } of games) {
    const teamId = content.sides.find((side) => side.side === content.winner)?.teamId
    if (teamId === series.teamAId) score.a++
    else if (teamId === series.teamBId) score.b++
    else return null
  }
  return score
}

/** Whether the recorded games decide the series: one side won enough games, or an even BO was played out. */
export const decidesSeries = (bestOf: number, score: { a: number; b: number }) =>
  resultProblem(bestOf, score.a, score.b, "https://example.org") === null

const everySeatNamed = (side: GameContent["sides"][number]) =>
  side.participants.length === 5 && side.participants.every((participant) => participant.playerId)

export function matchPasses(facts: MatchFacts, filter: MatchFilter): boolean {
  const { match, row, series, games } = facts
  const scored = hasScore(row)
  switch (filter) {
    case "ALL":
      return true
    case "NO_SCORE":
      return !scored
    case "NO_TIME":
      return !match.scheduledAt
    case "NO_VIDEO":
      return !!series && !youtubeVideoId(series.content.sourceUrl)
    case "GAMES_MISSING":
      return facts.gamesKnown && scored && games.length < row!.scoreA! + row!.scoreB!
    case "PLAYERS_MISSING":
      return games.some(({ content }) => !content.sides.every(everySeatNamed))
    case "SCORE_DIFFERS": {
      if (!series || !scored) return false
      const score = scoreFromGames(series.content, games)
      return !!score && decidesSeries(match.bestOf, score) && (score.a !== row!.scoreA || score.b !== row!.scoreB)
    }
    case "NOT_OPEN":
      return !match.seriesId && !!row?.teamAId && !!row.teamBId
    case "MISMATCH":
      return !!row && !row.consistent
    case "UNPUBLISHED":
      return facts.published !== undefined && (row?.scoreA ?? null) !== (facts.published?.scoreA ?? null)
  }
}

export const filterCounts = (facts: readonly MatchFacts[]) =>
  Object.fromEntries(
    MATCH_FILTERS.map((filter) => [filter, facts.filter((row) => matchPasses(row, filter)).length]),
  ) as Record<MatchFilter, number>

/* ---- Quick results ---- */

export type QuickResult = { scoreA: string; scoreB: string; video: string }

export const quickResultOf = (series: SeriesContent): QuickResult => ({
  scoreA: series.result ? String(series.result.scoreA) : "",
  scoreB: series.result ? String(series.result.scoreB) : "",
  video: series.sourceUrl ?? "",
})

/** What is wrong with one quick line; null when it can be saved, or has nothing to save. */
export function quickResultProblem(bestOf: number, line: QuickResult, before: QuickResult, source: string) {
  const video = line.video.trim()
  if (video !== before.video.trim() && video && !isWebLink(video)) return "Link cần bắt đầu bằng https:// hoặc http://."
  if (line.scoreA === before.scoreA && line.scoreB === before.scoreB) return null
  if (!line.scoreA && !line.scoreB) return "Xóa tỷ số ở bảng chi tiết của trận."
  return resultProblem(bestOf, toScore(line.scoreA), toScore(line.scoreB), source)
}

const toScore = (value: string) => (value === "" ? null : Number(value))

export const quickResultChanged = (line: QuickResult, before: QuickResult) =>
  line.scoreA !== before.scoreA || line.scoreB !== before.scoreB || line.video.trim() !== before.video.trim()

/** Scores of pasted lines such as "3-1", "3 : 1" or a spreadsheet's two columns; null for a line without one. */
export function pastedScores(text: string): ({ a: string; b: string } | null)[] {
  return pastedLines(text).map((line) => {
    const found = /(\d{1,2})\s*(?:[-:–—]|\s|\t)\s*(\d{1,2})/.exec(line)
    return found ? { a: found[1]!, b: found[2]! } : null
  })
}

/** The first link of each pasted line; empty for a line without one. */
export const pastedLinks = (text: string) => pastedLines(text).map((line) => /https?:\/\/\S+/i.exec(line)?.[0] ?? "")

const pastedLines = (text: string) => {
  const lines = text.replace(/\r/g, "").split("\n")
  while (lines.length && !lines.at(-1)!.trim()) lines.pop()
  return lines
}

/* ---- Times and rounds ---- */

/** Matches with their times moved by a number of minutes; a match without a time stays without one. */
export const shiftedTimes = (matches: PlannedMatch[], keys: ReadonlySet<string>, minutes: number): PlannedMatch[] =>
  matches.map((match) =>
    keys.has(match.key) && match.scheduledAt
      ? { ...match, scheduledAt: new Date(Date.parse(match.scheduledAt) + minutes * 60_000).toISOString() }
      : match,
  )

export type SpreadTimes = {
  /** Wall clock of the first match in the tournament's zone, `yyyy-mm-ddThh:mm`. */
  start: string
  minutesApart: number
  /** Matches played on one day before the next day starts at the same hour. */
  perDay: number
  daysApart: number
}

/** Matches given times one after another, in the order listed: so many a day, so many minutes apart. */
export function spreadTimes(
  matches: PlannedMatch[],
  keys: readonly string[],
  spread: SpreadTimes,
  timeZone: string,
): PlannedMatch[] {
  const at = new Map(keys.map((key, index) => [key, index]))
  return matches.map((match) => {
    const index = at.get(match.key)
    if (index === undefined) return match
    const day = Math.floor(index / Math.max(1, spread.perDay)) * Math.max(0, spread.daysApart)
    const minutes = (index % Math.max(1, spread.perDay)) * spread.minutesApart
    const wall = new Date(`${spread.start}:00Z`)
    wall.setUTCDate(wall.getUTCDate() + day)
    wall.setUTCMinutes(wall.getUTCMinutes() + minutes)
    return { ...match, scheduledAt: zonedInputInstant(wall.toISOString().slice(0, 16), timeZone) }
  })
}

export const ROUND_RULES = ["DAY", "WEEK", "ONCE_EACH"] as const
export type RoundRule = (typeof ROUND_RULES)[number]
export const ROUND_RULE_LABELS: Record<RoundRule, string> = {
  DAY: "Mỗi ngày đấu một vòng",
  WEEK: "Mỗi tuần một vòng",
  ONCE_EACH: "Mỗi đội một trận mỗi vòng",
}

const byTime = (a: PlannedMatch, b: PlannedMatch) =>
  (a.scheduledAt ? Date.parse(a.scheduledAt) : Infinity) - (b.scheduledAt ? Date.parse(b.scheduledAt) : Infinity)

/** The Monday of a day's week, as yyyy-mm-dd. */
function weekOf(day: string) {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}

/** Round numbers read from the calendar, or from who has played already. Matches without a time keep their round. */
export function numberedRounds(
  matches: PlannedMatch[],
  stageCode: string,
  rule: RoundRule,
  timeZone: string,
  resolved: ReadonlyMap<string, ResolvedMatch>,
): PlannedMatch[] {
  const stage = matches.filter((match) => match.stageCode === stageCode).sort(byTime)
  const rounds = new Map<string, number>()
  if (rule === "ONCE_EACH") {
    const played = new Map<string, number>()
    for (const match of stage) {
      const row = resolved.get(match.key)
      const sides = [row?.teamAId ?? match.a.teamId, row?.teamBId ?? match.b.teamId].filter((id): id is string => !!id)
      if (!sides.length) continue
      const round = 1 + Math.max(...sides.map((id) => played.get(id) ?? 0))
      for (const id of sides) played.set(id, round)
      rounds.set(match.key, round)
    }
  } else {
    const groups: string[] = []
    for (const match of stage) {
      if (!match.scheduledAt) continue
      const day = dayKeyInZone(match.scheduledAt, timeZone)!
      const group = rule === "DAY" ? day : weekOf(day)
      if (!groups.includes(group)) groups.push(group)
      rounds.set(match.key, groups.indexOf(group) + 1)
    }
  }
  return matches.map((match) => {
    const round = rounds.get(match.key)
    return round === undefined || round === match.round ? match : { ...match, round }
  })
}

/* ---- Bracket links ---- */

export type BracketLink = { key: string; side: "a" | "b"; slot: CompetitionSlot; from: PlannedMatch }

/**
 * Winner and loser slots read from who played next. Imported brackets name both teams of every match, so the matches
 * stand beside each other; a team's earlier match of the stage tells where it came from. Links only name a team the
 * match already has, so no pairing changes. An outcome leads to one match at most.
 */
export function inferredLinks(
  plan: Pick<CompetitionPlan, "matches">,
  stageCode: string,
  resolved: ReadonlyMap<string, ResolvedMatch>,
): BracketLink[] {
  const stage = plan.matches.filter((match) => match.stageCode === stageCode)
  const order = new Map(stage.map((match, index) => [match.key, index]))
  const ordered = [...stage].sort((a, b) => byTime(a, b) || order.get(a.key)! - order.get(b.key)!)
  const used = new Set(
    stage.flatMap((match) =>
      [match.a, match.b].filter((slot) => slot.matchKey).map((slot) => `${slot.type}:${slot.matchKey}`),
    ),
  )
  const links: BracketLink[] = []
  ordered.forEach((match, index) => {
    const row = resolved.get(match.key)
    for (const side of ["a", "b"] as const) {
      const slot = match[side]
      const teamId = side === "a" ? row?.teamAId : row?.teamBId
      if (slot.type !== "TEAM" || !teamId) continue
      const from = ordered
        .slice(0, index)
        .reverse()
        .find((earlier) => {
          const before = resolved.get(earlier.key)
          return before && [before.teamAId, before.teamBId].includes(teamId)
        })
      const before = from && resolved.get(from.key)
      if (!from || !before || !hasScore(before) || !before.consistent || before.scoreA === before.scoreB) continue
      const won = (before.scoreA! > before.scoreB! ? before.teamAId : before.teamBId) === teamId
      const type = won ? "WINNER" : "LOSER"
      if (used.has(`${type}:${from.key}`)) continue
      used.add(`${type}:${from.key}`)
      links.push({ key: match.key, side, slot: { type, matchKey: from.key }, from })
    }
  })
  return links
}

/**
 * The plan's matches with the links in place. A slot may only name a match listed before it, so the matches of the
 * stage take the order they were played in, in the places the stage already holds.
 */
export function linkedMatches(matches: PlannedMatch[], stageCode: string, links: readonly BracketLink[]) {
  const linked = matches.map((match) => {
    const own = links.filter((link) => link.key === match.key)
    if (!own.length) return match
    return own.reduce<PlannedMatch>((value, link) => ({ ...value, [link.side]: link.slot }), match)
  })
  const stage = linked.filter((match) => match.stageCode === stageCode)
  const position = new Map(stage.map((match, index) => [match.key, index]))
  const depth = new Map<string, number>()
  const depthOf = (match: PlannedMatch): number => {
    const known = depth.get(match.key)
    if (known !== undefined) return known
    depth.set(match.key, 1)
    const sources = [match.a.matchKey, match.b.matchKey]
      .map((key) => stage.find((row) => row.key === key))
      .filter((row): row is PlannedMatch => !!row)
    const value = 1 + Math.max(0, ...sources.map(depthOf))
    depth.set(match.key, value)
    return value
  }
  stage.forEach(depthOf)
  const sorted = [...stage].sort(
    (a, b) => depth.get(a.key)! - depth.get(b.key)! || byTime(a, b) || position.get(a.key)! - position.get(b.key)!,
  )
  let next = 0
  return linked.map((match) =>
    match.stageCode === stageCode ? { ...sorted[next]!, round: depth.get(sorted[next++]!.key)! } : match,
  )
}

/** The days of a stage's first and last timed matches, in the tournament's zone. */
export function stageDays(plan: Pick<CompetitionPlan, "matches" | "timezone">, stageCode: string) {
  const days = plan.matches
    .filter((match) => match.stageCode === stageCode && match.scheduledAt)
    .map((match) => dayKeyInZone(match.scheduledAt!, plan.timezone))
    .filter((day): day is string => !!day)
    .sort()
  return days.length ? { first: days[0]!, last: days.at(-1)! } : undefined
}

/** Stages in the order their first matches are played; stages without a timed match keep their place at the end. */
export function stagesByDate(plan: Pick<CompetitionPlan, "stages" | "matches">) {
  const first = (code: string) =>
    Math.min(
      Infinity,
      ...plan.matches
        .filter((match) => match.stageCode === code && match.scheduledAt)
        .map((match) => Date.parse(match.scheduledAt!)),
    )
  return plan.stages
    .map((stage, index) => ({ stage, index, at: first(stage.code) }))
    .sort((a, b) => (a.at === b.at ? a.index - b.index : a.at - b.at))
    .map((row) => row.stage)
}

/**
 * Seeds of a bracket read from the tables before it. Groups side by side give one seed each in turn, so the winners of
 * the groups take the first seeds; a single table gives its teams in order. Null while the tables are too short.
 */
export function seedsFromTables(
  stages: readonly CompetitionStage[],
  standings: CompetitionSnapshot["standings"],
  stageCode: string,
  count: number,
): Record<number, string> | null {
  const at = stages.findIndex((stage) => stage.code === stageCode)
  const before = stages.slice(0, at < 0 ? stages.length : at).reverse()
  const groups: CompetitionStage[] = []
  for (const stage of before) {
    const grouped = isLeagueStage(stage) && !!stage.teamIds?.length
    if (groups.length && !grouped) break
    if (isLeagueStage(stage)) groups.unshift(stage)
    if (!grouped) break
  }
  const tables = groups
    .map((stage) => standings.find((table) => table.stageCode === stage.code))
    .filter((table): table is CompetitionSnapshot["standings"][number] => !!table)
  const chosen = tables.length ? tables : [...standings].reverse().slice(0, 1)
  const teams: string[] = []
  for (let rank = 0; teams.length < count; rank++) {
    const row = chosen.flatMap((table) => table.rows[rank]?.teamId ?? [])
    if (!row.length) return null
    teams.push(...row)
  }
  return Object.fromEntries(teams.slice(0, count).map((teamId, index) => [index + 1, teamId]))
}

/** The date and the time of a match apart, as the bulk editor shows them. */
export function dateAndTime(value: string | null | undefined, timeZone: string) {
  const wall = zonedInputTime(value, timeZone)
  return { date: wall.slice(0, 10), time: wall.slice(11, 16) }
}

/** A moment from a date and a time of the tournament's zone; a date without a time starts at midnight. */
export const atDateAndTime = (date: string, time: string, timeZone: string) =>
  date ? zonedInputInstant(`${date}T${time || "00:00"}`, timeZone) : null
