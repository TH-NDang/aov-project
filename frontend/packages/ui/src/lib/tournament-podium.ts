/** A final-table line as `TournamentPlacement` in @aov/community-contracts stores it. */
type PlacementLine = {
  place: string
  teamId?: string | null
  teamName: string
  lastOpponent?: string | null
  lastScore?: string | null
}

/** The champion typed by hand in the older tournament form (`TournamentResult`). */
type RecordedResult = {
  winnerName: string
  runnerUpName: string
  winnerScore?: number | null
  runnerUpScore?: number | null
}

export type PodiumTeam = { teamId?: string; name: string }
export type Podium = { winner: PodiumTeam; runnerUp: PodiumTeam | null; score: string | null }

const only = (lines: PlacementLine[], place: string) => {
  const found = lines.filter((line) => line.place.trim() === place && line.teamName.trim())
  return found.length === 1 ? found[0] : undefined
}

const team = (line: PlacementLine): PodiumTeam =>
  line.teamId ? { teamId: line.teamId, name: line.teamName.trim() } : { name: line.teamName.trim() }

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()

/** "4:2", "4 - 2" or "4–2" as "4–2"; anything else is not a score. */
function score(text: string | null | undefined) {
  const match = text?.match(/^\s*(\d+)\s*[-–:]\s*(\d+)\s*$/)
  return match ? `${match[1]}–${match[2]}` : null
}

function recordedScore(result: RecordedResult | null | undefined) {
  return result?.winnerScore != null && result.runnerUpScore != null
    ? `${result.winnerScore}–${result.runnerUpScore}`
    : null
}

/**
 * The champion and the runner-up of a tournament. The final table, which the workspace's final step saves, decides:
 * its single first place and single second place. The result typed in the older tournament form is read only when the
 * table has no single first place. The score is the champion's last result against the runner-up, or the recorded score
 * when the recorded champion is the same team.
 */
export function tournamentPodium(content: {
  placements?: PlacementLine[] | null
  result?: RecordedResult | null
}): Podium | null {
  const lines = content.placements ?? []
  const first = only(lines, "1")
  const result = content.result

  if (first) {
    const second = only(lines, "2")
    const runnerUp = second ? team(second) : null
    const facedRunnerUp = runnerUp && first.lastOpponent && sameName(first.lastOpponent, runnerUp.name)
    const recorded = result?.winnerName && sameName(result.winnerName, first.teamName) ? recordedScore(result) : null
    return { winner: team(first), runnerUp, score: (facedRunnerUp && score(first.lastScore)) || recorded }
  }

  if (!result?.winnerName?.trim()) return null
  return {
    winner: { name: result.winnerName.trim() },
    runnerUp: result.runnerUpName?.trim() ? { name: result.runnerUpName.trim() } : null,
    score: recordedScore(result),
  }
}
