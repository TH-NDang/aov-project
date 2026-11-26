import type {
  CompetitionPlan,
  CompetitionSnapshot,
  CompetitionStage,
  CompetitionType,
  ResolvedMatch,
  TeamContent,
} from "@aov/community-contracts"
import { matchResult, type MatchResult } from "@aov/community-contracts/bracket-results"
import { dayKeyInZone } from "@aov/ui/lib/time-zone"
import { stagesByDate } from "../model/schedule-model"
import { isLeagueStage, resolvedIndex } from "./model"

export type PlacementInput = {
  plan: CompetitionPlan
  resolved: ResolvedMatch[]
  standings: CompetitionSnapshot["standings"]
  teams: Record<string, TeamContent>
  competitionType?: CompetitionType
  /** Whether the tournament is over; an open match of a running one is still to come. */
  finished: boolean
  /** The last day of the tournament (yyyy-mm-dd). */
  endsOn?: string
}

/** A stage, or several read as one: the legs of a league, or groups played side by side. */
export type Phase = {
  kind: "TABLE" | "BRACKET" | "CUSTOM"
  stages: CompetitionStage[]
  results: MatchResult[]
  teams: Set<string>
  /** Why it is not read, such as a team replaced by another halfway, so that two tables hold half a season each. */
  broken?: string
}

/** Where a team stands among those that leave the tournament in a phase; slots count from 1. */
export type Slot = {
  /** Absent while the match that gives the place is open. */
  teamId?: string
  from: number
  to: number
  reason: string
  last?: MatchResult
}

/** What a phase tells about the teams that leave in it: their slots, and why the others have none. */
export type Reading = {
  slots: Slot[]
  open: Map<string, string>
  /** Stages that leave teams level and record no rule to tell them apart. */
  level?: CompetitionStage[]
}

export const unreadable = (teams: Iterable<string>, reason: string): Reading => ({
  slots: [],
  open: new Map([...teams].map((id) => [id, reason])),
})

const sidesOf = ({ match, teamA, teamB }: MatchResult) => [
  { slot: match.a, team: teamA },
  { slot: match.b, team: teamB },
]

/** A match with a side nobody fills yet and no other match decides. */
export const hasOpenSide = (result: MatchResult) =>
  sidesOf(result).some(({ slot, team }) => !team && slot.type !== "WINNER" && slot.type !== "LOSER")

const teamsOf = (results: MatchResult[]) =>
  new Set(results.flatMap(({ teamA, teamB }) => [teamA, teamB].filter((id) => id != null)))

export const teamsIn = (phases: Phase[]) => new Set(phases.flatMap((phase) => [...phase.teams]))

/** Sorts members into the groups that hang together by links, each between two of them. */
function connected(members: Iterable<string>, links: Iterable<readonly [string, string]>): string[][] {
  const parent = new Map([...members].map((id) => [id, id]))
  const root = (id: string): string => (parent.get(id) === id ? id : root(parent.get(id)!))
  for (const [one, other] of links) parent.set(root(one), root(other))
  const groups = new Map<string, string[]>()
  for (const id of parent.keys()) groups.set(root(id), [...(groups.get(root(id)) ?? []), id])
  return [...groups.values()]
}

/** The teams that meet each other, directly or through others. */
export const meetingGroups = (results: MatchResult[]) =>
  connected(
    teamsOf(results),
    results.flatMap(({ teamA, teamB }) => (teamA && teamB ? [[teamA, teamB] as const] : [])),
  )

export const resultsAmong = (teams: readonly string[], results: MatchResult[]) =>
  results.filter(({ teamA, teamB }) => teams.includes(teamA ?? "") || teams.includes(teamB ?? ""))

/**
 * Whether the teams a table leaves behind for another table are those that won the least in their group. They are
 * not when a team was entered again under another record, and the two tables are the halves of one season.
 */
function leavesTheLast(before: Phase, teams: Set<string>) {
  const wins = (id: string) => before.results.filter(({ winner }) => winner === id).length
  return meetingGroups(before.results).every((group) => {
    const staying = group.filter((id) => teams.has(id)).map(wins)
    const leaving = group.filter((id) => !teams.has(id)).map(wins)
    return Math.max(0, ...leaving) <= Math.min(Infinity, ...staying)
  })
}

/** Adds a table to the phases: to the one before when they are legs of one league or groups side by side. */
function addTable(
  phases: Phase[],
  stage: CompetitionStage,
  results: MatchResult[],
  names: Record<string, TeamContent>,
) {
  const phase: Phase = { kind: "TABLE", stages: [stage], results, teams: teamsOf(results) }
  const before = phases.at(-1)
  const come = [...phase.teams].filter((id) => !before?.teams.has(id))
  const gone = [...(before?.teams ?? [])].filter((id) => !phase.teams.has(id))
  const sideBySide = come.length === phase.teams.size
  if (before?.kind === "TABLE" && (sideBySide || (!come.length && !gone.length))) {
    before.stages.push(stage)
    before.results.push(...results)
    for (const id of phase.teams) before.teams.add(id)
    return
  }

  if (before?.kind === "TABLE" && !leavesTheLast(before, phase.teams)) {
    const others = [...gone, ...come].map((id) => names[id]?.name ?? "").join(", ")
    phase.broken = `${stagesText([...before.stages, stage])} không cùng các đội (${others})`
    before.broken = phase.broken
  }
  phases.push(phase)
}

/**
 * The matches of an elimination stage by the events they belong to. An import puts show matches in the stage of the
 * bracket, where their teams meet nobody else. A qualifier keeps its matches together: the parts that send a team on
 * each are played apart from each other.
 */
function separateEvents(results: MatchResult[], competitionType?: CompetitionType) {
  if (competitionType === "QUALIFIER") return [results]

  const keys = new Set(results.map(({ match }) => match.key))
  const links = results.flatMap((result) =>
    sidesOf(result).flatMap(({ slot, team }) => [
      ...(team ? [[result.match.key, team] as const] : []),
      ...(slot.matchKey && keys.has(slot.matchKey) ? [[result.match.key, slot.matchKey] as const] : []),
    ]),
  )
  const events = connected([...keys, ...teamsOf(results)], links)
    .map((members) => results.filter(({ match }) => members.includes(match.key)))
    .filter((event) => event.length)
  return new Set(events.map((event) => event.length)).size > 1 ? events : [results]
}

const hoursOf = (phase: Phase, teamId: string) =>
  phase.results.flatMap(({ match, teamA, teamB }) =>
    match.scheduledAt && (teamA === teamId || teamB === teamId) ? [Date.parse(match.scheduledAt)] : [],
  )

/** One bracket planned as several stages, its teams going to and fro between them, is none of these stages alone. */
function markAlternating(phases: Phase[]) {
  const brackets = phases.filter((phase) => phase.kind === "BRACKET")
  brackets.forEach((late, at) => {
    for (const early of brackets.slice(0, at)) {
      const returns = [...late.teams].some(
        (id) => early.teams.has(id) && Math.max(...hoursOf(early, id)) > Math.min(...hoursOf(late, id)),
      )
      if (returns) early.broken = late.broken = `${stagesText([...early.stages, ...late.stages])} đá xen kẽ nhau`
    }
  })
}

const DAY_MS = 86_400_000

/**
 * The stages in the order they were played: by the first hour of their matches. An import that knew only the day of a
 * match stored it at midnight UTC, before the real hours of that day, so a stage whose every hour is such a midnight
 * goes after the stages with real hours on the same day of the tournament.
 */
function playOrder(plan: CompetitionPlan) {
  const rows = stagesByDate(plan).map((stage) => {
    const hours = plan.matches.flatMap(({ stageCode, scheduledAt }) =>
      stageCode === stage.code && scheduledAt ? [Date.parse(scheduledAt)] : [],
    )
    const known = hours.filter(Number.isFinite)
    return {
      stage,
      // A stage without hours stays last, as the schedule keeps it.
      day: known.length ? dayKeyInZone(Math.min(...known), plan.timezone) : "~",
      dayOnly: known.length > 0 && known.every((hour) => hour % DAY_MS === 0),
    }
  })
  return rows
    .sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : Number(x.dayOnly) - Number(y.dayOnly)))
    .map(({ stage }) => stage)
}

/** The phases of a tournament in the order they are played. */
export function phasesOf({ plan, resolved, teams, competitionType, finished }: PlacementInput): Phase[] {
  const rows = resolvedIndex(resolved)
  const phases: Phase[] = []
  for (const stage of playOrder(plan)) {
    const results = plan.matches
      .filter((match) => match.stageCode === stage.code)
      .map((match) => matchResult(match, rows.get(match.key)))
      // Once it is over, a match that never found a team was not played.
      .filter(({ teamA, teamB }) => !finished || teamA || teamB)
    if (!results.length) continue

    if (isLeagueStage(stage)) {
      addTable(phases, stage, results, teams)
      continue
    }
    const kind = stage.format === "CUSTOM" ? "CUSTOM" : "BRACKET"
    for (const event of separateEvents(results, competitionType))
      phases.push({ kind, stages: [stage], results: event, teams: teamsOf(event) })
  }
  markAlternating(phases)
  // Any team may have played in a stage that names none.
  const empty = plan.stages.find((stage) => !phases.some((phase) => phase.stages.includes(stage)))
  if (empty) for (const phase of phases) phase.broken = `Chưa biết ai đá ở ${empty.name}`
  return phases
}

/**
 * The phases that hang together by their teams around the one with the most matches, and those apart from them. While
 * the tournament goes on, a phase that waits for a team may get it from any other.
 */
export function mainPhases(phases: Phase[], finished: boolean) {
  const index = phases.map((_, at) => String(at))
  const waits = (phase: Phase) => !finished && phase.results.some(hasOpenSide)
  const links = phases.flatMap((phase, at) =>
    phases.slice(0, at).flatMap((other, before) => {
      const linked = waits(phase) || waits(other) || [...phase.teams].some((id) => other.teams.has(id))
      return linked ? [[String(at), String(before)] as const] : []
    }),
  )
  const matches = (group: string[]) => group.reduce((sum, at) => sum + phases[Number(at)]!.results.length, 0)
  const [largest = []] = connected(index, links).sort((x, y) => matches(y) - matches(x))
  return {
    main: phases.filter((_, at) => largest.includes(String(at))),
    apart: phases.filter((_, at) => !largest.includes(String(at))),
  }
}

/** The names of some stages in a sentence: one, two, or from the first to the last. */
export function stagesText(stages: CompetitionStage[]) {
  const names = [...new Set(stages.map((stage) => stage.name))]
  return names.length > 2 ? `${names[0]} đến ${names.at(-1)}` : names.join(" và ")
}
