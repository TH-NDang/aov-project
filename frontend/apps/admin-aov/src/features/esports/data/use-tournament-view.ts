import { useCallback, useMemo } from "react"
import { bySchedule, type SeriesRecord } from "../model/competition"
import { teamView, type TeamView } from "../model/game-view"
import { useRecords } from "./use-esports-data"

/** Everything the tournament pages share: the tournament, its series and a team lookup. */
export function useTournamentView(tournamentId: string, enabled = true) {
  const tournaments = useRecords("tournaments", enabled)
  const teams = useRecords("teams", enabled)
  const series = useRecords("series", enabled)
  const tournament = tournaments.data?.find((entry) => entry.id === tournamentId)
  const records = useMemo<SeriesRecord[]>(
    () => (series.data ?? []).filter((entry) => entry.content.tournamentId === tournamentId).sort(bySchedule),
    [series.data, tournamentId],
  )
  const teamIndex = useMemo(() => new Map((teams.data ?? []).map((entry) => [entry.id, entry])), [teams.data])
  const team = useCallback((id: string): TeamView => teamView(teamIndex.get(id), id), [teamIndex])
  const teamIds = useMemo(
    () => [...new Set(records.flatMap((record) => [record.content.teamAId, record.content.teamBId]))],
    [records],
  )
  const error = tournaments.error ?? teams.error ?? series.error
  return {
    tournament,
    records,
    team,
    teamIds,
    teams: teams.data ?? [],
    pending: tournaments.isPending || teams.isPending || series.isPending,
    error,
    refetch: () => Promise.all([tournaments.refetch(), teams.refetch(), series.refetch()]),
  }
}
