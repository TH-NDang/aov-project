import { byHour } from "@aov/community-contracts/bracket-results"
import { hasOpenSide, meetingGroups, resultsAmong, teamsIn, type Phase, type PlacementInput } from "./placement-phases"
import { rowsOf } from "./placement-table"

/** Whether each of some teams came out of a phase below each of the others that played on after it. */
function cameOutBelow(input: PlacementInput, source: Phase, teams: string[], others: string[]) {
  if (source.kind !== "TABLE")
    return teams.every((id) => resultsAmong([id], source.results).sort(byHour).at(-1)?.loser === id)

  const rank = (id: string) => {
    const rows = rowsOf(input, source, id)
    return rows.length === 1 ? rows[0]!.rank : NaN
  }
  const ranks = (group: string[], ids: string[]) => ids.filter((id) => group.includes(id)).map(rank)
  return (
    others.length > 0 &&
    meetingGroups(source.results).every((group) => Math.max(...ranks(group, others)) < Math.min(...ranks(group, teams)))
  )
}

/**
 * The phases that lead to the title, and the branches beside them: those who are out play on for the places they left
 * with, such as the third place in a stage of its own or the fifth to eighth place, and never meet anybody else again.
 */
export function splitPath(input: PlacementInput, phases: Phase[]): { path: Phase[]; branches: Phase[][] } {
  const branches: Phase[][] = []
  const beside = (phase: Phase) => branches.some((branch) => branch.includes(phase))
  phases.forEach((phase, at) => {
    const later = phases.slice(at + 1).filter((other) => [...other.teams].some((id) => phase.teams.has(id)))
    const branch = [phase, ...later]
    const closed = later.every((other) => [...other.teams].every((id) => phase.teams.has(id)))
    const filled = branch.every((other) => other.teams.size && !other.results.some(hasOpenSide))
    const source = phases
      .slice(0, at)
      .reverse()
      .find((other) => !beside(other) && [...phase.teams].every((id) => other.teams.has(id)))
    if (beside(phase) || !closed || !filled || !source) return

    const after = phases.slice(phases.indexOf(source) + 1).filter((other) => !branch.includes(other))
    const others = [...teamsIn(after)].filter((id) => source.teams.has(id) && !phase.teams.has(id))
    if (cameOutBelow(input, source, [...phase.teams], others)) branches.push(branch)
  })
  return { path: phases.filter((phase) => !beside(phase)), branches }
}
