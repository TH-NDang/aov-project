import type { CompetitionView } from "@aov/community-contracts"
import { dayKeyInZone } from "@aov/ui/lib/time-zone"

/** A match is treated as under way for this long after its start when no score has been entered yet. */
export const MATCH_WINDOW = 3 * 60 * 60 * 1000

export type ScheduledMatch = {
  key: string
  at: number
  /** The zone the competition is played in, where the original start time is read. */
  timeZone: string
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
export function scheduledMatches(views: CompetitionView[], locale = "vi-VN"): ScheduledMatch[] {
  const undecided = locale.startsWith("en") ? "TBD" : "Chờ xác định"
  return views.flatMap((view) => {
    const { plan, teams, resolved, tournament } = view.content
    const results = new Map(resolved.map((match) => [match.key, match]))
    const team = (id: string | null | undefined, label: string | null | undefined) => {
      const entry = id ? teams[id] : undefined
      return entry?.shortName || entry?.name || label || undecided
    }
    return plan.matches.flatMap((match) => {
      const at = match.scheduledAt ? new Date(match.scheduledAt).getTime() : NaN
      if (Number.isNaN(at)) return []
      const result = results.get(match.key)
      return [
        {
          key: `${view.id}:${match.key}`,
          at,
          timeZone: plan.timezone,
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

/** Today's matches, where "today" is the reader's day in `timeZone`, or the next ones when nothing is on today. */
export function matchesToShow(
  matches: ScheduledMatch[],
  now = Date.now(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  const day = dayKeyInZone(now, timeZone)
  const byTime = [...matches].sort((a, b) => a.at - b.at)
  const today = byTime.filter((match) => dayKeyInZone(match.at, timeZone) === day)
  return today.length
    ? { today: true, items: today.slice(0, 6) }
    : { today: false, items: byTime.filter((match) => match.at >= now).slice(0, 4) }
}
