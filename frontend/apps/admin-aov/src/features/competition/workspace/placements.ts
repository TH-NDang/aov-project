import type { CompetitionStage } from "@aov/community-contracts"
import { calendarDaysBetween } from "@aov/ui/lib/time-zone"
import { isClosed, readElimination } from "./placement-bracket"
import { splitPath } from "./placement-path"
import {
  mainPhases,
  phasesOf,
  stagesText,
  teamsIn,
  unreadable,
  type Phase,
  type PlacementInput,
  type Reading,
  type Slot,
} from "./placement-phases"
import { readTable } from "./placement-table"

export type SuggestedPlacement = {
  /** One place, or the places it shares with others ("5-6"). */
  place: string
  /** Absent while the match that gives the place is open. */
  teamId?: string
  teamName: string
  reason: string
  /** The team's last match in the bracket: who it played and the score from its side, such as "4–2". */
  lastOpponent?: string
  lastScore?: string
}

/** A team whose place nothing recorded tells, and why. */
export type OpenTeam = {
  teamId: string
  teamName: string
  reason: string
  /** It is in no match of the plan, so it may not have taken part at all. */
  idle: boolean
}

export type PlacementSuggestions = {
  lines: SuggestedPlacement[]
  open: OpenTeam[]
  /** The teams still in, whose last match has no result yet. */
  waiting: string[]
  /** Stages that leave teams out of the bracket level and record no rule to tell them apart. */
  level: CompetitionStage[]
}

export const placeText = (from: number, to: number) => (from === to ? String(from) : `${from}-${to}`)

/** Whether a tournament went on for days after the last match of its plan, so that matches are missing there. */
function lacksTheEnd({ plan, endsOn }: PlacementInput) {
  const hours = plan.matches.flatMap(({ scheduledAt }) => (scheduledAt ? [Date.parse(scheduledAt)] : []))
  return !!endsOn && !!hours.length && calendarDaysBetween(new Date(Math.max(...hours)), endsOn, plan.timezone) > 1
}

/** The phases none of whose teams play on in a later one. */
const endsOf = (phases: Phase[]) =>
  phases.filter((phase, at) => {
    const later = teamsIn(phases.slice(at + 1))
    return ![...phase.teams].some((id) => later.has(id))
  })

/** Why a phase tells nothing about the teams it leaves behind, whatever its results. */
function unknownAfter(input: PlacementInput, phases: Phase[], at: number) {
  const phase = phases[at]!
  if (phase.broken) return phase.broken

  const last = at === phases.length - 1
  if (last && (input.finished ? lacksTheEnd(input) : phase.kind === "TABLE"))
    return `Giải có thể còn trận sau ${stagesText(phase.stages)}`
  // While the tournament goes on, a team that seems out may still come into a phase that is not closed.
  const unsure = phases.slice(phase.kind === "BRACKET" ? at : at + 1).find((other) => !isClosed(other))
  if (!input.finished && unsure) return `Chưa rõ hết các đội ở ${stagesText(unsure.stages)}`

  const ends = endsOf(phases)
  if (ends.length < 2) return null
  return `${stagesText(ends.flatMap(({ stages }) => stages))} cùng là giai đoạn cuối, chưa rõ giai đoạn nào tranh vô địch`
}

function readPhase(input: PlacementInput, phases: Phase[], at: number, named: boolean): Reading {
  const phase = phases[at]!
  const laterTeams = teamsIn(phases.slice(at + 1))
  const exits = new Set([...phase.teams].filter((id) => !laterTeams.has(id)))
  const unknown = unknownAfter(input, phases, at)
  if (unknown) return unreadable(exits, unknown)

  const last = at === phases.length - 1
  if (phase.kind !== "TABLE") return readElimination(input, phase, exits, { last, named: named || !last })

  const before = teamsIn(phases.slice(0, at + 1))
  return readTable(input, phase, exits, [...laterTeams].filter((id) => !before.has(id)).length, last)
}

/** What some phases in a row tell, with every slot counted from the first place they give. */
function readPhases(input: PlacementInput, phases: Phase[], named: boolean) {
  const readings = phases.map((_, at) => ({
    ahead: teamsIn(phases.slice(at + 1)).size,
    ...readPhase(input, phases, at, named),
  }))
  return {
    slots: readings.flatMap(({ ahead, slots }) =>
      slots.map((slot) => ({ ...slot, from: ahead + slot.from, to: ahead + slot.to })),
    ),
    open: readings.flatMap((reading) => [...reading.open]),
    level: readings.flatMap((reading) => reading.level ?? []),
  }
}

/**
 * The slots after a branch: its teams play for the places they hold together, so theirs are read from it. Where other
 * teams hold places among them, the branch decides something else, and none of those places is known.
 */
function afterBranch(input: PlacementInput, slots: Slot[], branch: Phase[]) {
  const teams = teamsIn(branch)
  const held = slots.filter(({ teamId }) => teamId && teams.has(teamId))
  const from = Math.min(...held.map((slot) => slot.from))
  const to = Math.max(...held.map((slot) => slot.to))
  const others = slots.filter((slot) => !held.includes(slot))
  const among = others.filter((slot) => slot.from <= to && slot.to >= from)
  if (held.length !== teams.size || held.length !== to - from + 1 || among.length) {
    const reason = `${stagesText(branch.flatMap(({ stages }) => stages))} đá thêm, chưa rõ tranh hạng nào`
    const unsure = [...teams, ...among.flatMap(({ teamId }) => teamId ?? [])]
    return {
      slots: others.filter((slot) => !among.includes(slot)),
      open: unsure.map((id): [string, string] => [id, reason]),
      level: [],
    }
  }
  const read = readPhases(input, branch, true)
  const placed = read.slots.map((slot) => ({ ...slot, from: from - 1 + slot.from, to: from - 1 + slot.to }))
  return { ...read, slots: [...others, ...placed] }
}

/**
 * The final places the results tell, best first. The last phase gives the champion; every team then stands by the
 * last phase it played and by how it left it: the round of its last lost match in a bracket, where those who lost in
 * one round share their places, or its rank in a table. A team whose place the results leave open is listed with the
 * reason, and nothing is guessed.
 */
export function suggestedPlacements(input: PlacementInput): PlacementSuggestions {
  const name = (id?: string | null) => (id && input.teams[id]?.name) || ""
  const phases = phasesOf(input)
  const { main, apart } = mainPhases(phases, input.finished)
  const { path, branches } = splitPath(input, main)
  const open = new Map<string, string>()
  for (const phase of apart)
    for (const id of phase.teams) open.set(id, `Đá ở ${stagesText(phase.stages)}, tách khỏi các giai đoạn khác`)

  const level = new Set<CompetitionStage>()
  let slots: Slot[] = []
  const take = (read: ReturnType<typeof readPhases>) => {
    slots = read.slots
    for (const [id, reason] of read.open) if (!open.has(id)) open.set(id, reason)
    for (const stage of read.level) level.add(stage)
  }
  take(readPhases(input, path, false))
  for (const branch of branches) take(afterBranch(input, slots, branch))

  const lines = slots.map(({ teamId, from, to, reason, last }) => {
    const won = !!last && last.winner === teamId
    const [own, rival] = won ? [0, 1] : [1, 0]
    return {
      from,
      to,
      teamId,
      teamName: name(teamId),
      reason,
      lastOpponent: name(won ? last?.loser : last?.winner) || undefined,
      lastScore: last?.score ? `${last.score[own]}–${last.score[rival]}` : undefined,
    }
  })
  for (const { teamId } of lines) if (teamId) open.delete(teamId)
  const played = teamsIn(phases)
  const placed = new Set(lines.map((line) => line.teamId))
  const waiting = [...played].filter((id) => !placed.has(id) && !open.has(id))
  for (const { teamId, status } of input.plan.entrants)
    if (status !== "WITHDRAWN" && !played.has(teamId)) open.set(teamId, "Không có trận nào trong lịch")

  return {
    lines: lines
      .sort((x, y) => x.from - y.from || x.to - y.to)
      .map(({ from, to, ...line }) => ({ place: placeText(from, to), ...line })),
    open: [...open].map(([teamId, reason]) => ({ teamId, teamName: name(teamId), reason, idle: !played.has(teamId) })),
    waiting,
    level: [...level],
  }
}
