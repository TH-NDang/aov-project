import type { CompetitionView } from "@aov/community-contracts"

/** A match is treated as under way for this long after its start when no score has been entered yet. */
export const MATCH_WINDOW = 3 * 60 * 60 * 1000

export type ScheduledMatch = {
  key: string
  at: number
  competitionId: string
  matchKey: string
  tournament: string
  teamA: string
  teamB: string
  /** Registry team ids, when the slot is already decided. */
  teamAId?: string | null
  teamBId?: string | null
  scoreA?: number | null
  scoreB?: number | null
}

/** Every planned match with a start time, named from the teams the competition snapshot already resolved. */
export function scheduledMatches(views: CompetitionView[]): ScheduledMatch[] {
  return views.flatMap((view) => {
    const { plan, teams, resolved, tournament } = view.content
    const results = new Map(resolved.map((match) => [match.key, match]))
    const team = (id: string | null | undefined, label: string | null | undefined) => {
      const entry = id ? teams[id] : undefined
      return entry?.shortName || entry?.name || label || "Chờ xác định"
    }
    return plan.matches.flatMap((match) => {
      const at = match.scheduledAt ? new Date(match.scheduledAt).getTime() : NaN
      if (Number.isNaN(at)) return []
      const result = results.get(match.key)
      return [
        {
          key: `${view.id}:${match.key}`,
          at,
          competitionId: view.id,
          matchKey: match.key,
          tournament: tournament.name,
          teamA: team(result?.teamAId || match.a.teamId, match.a.label),
          teamB: team(result?.teamBId || match.b.teamId, match.b.label),
          teamAId: result?.teamAId || match.a.teamId,
          teamBId: result?.teamBId || match.b.teamId,
          scoreA: result?.scoreA,
          scoreB: result?.scoreB,
        },
      ]
    })
  })
}

/** Today's matches, or the next ones when nothing is scheduled today. */
export function matchesToShow(matches: ScheduledMatch[], now = Date.now()) {
  const day = new Date(now)
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
  const end = start + 24 * 60 * 60 * 1000
  const byTime = [...matches].sort((a, b) => a.at - b.at)
  const today = byTime.filter((match) => match.at >= start && match.at < end)
  return today.length
    ? { today: true, items: today.slice(0, 6) }
    : { today: false, items: byTime.filter((match) => match.at >= now).slice(0, 4) }
}
