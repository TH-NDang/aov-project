import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "react-router"
import { useStreamLocale } from "../../../components/stream-locale"
import {
  competitionMatches,
  competitionMatchHref,
  findSeriesMatch,
  matchSeriesId,
  orderedMatchGames,
} from "../../../lib/match-model"
import { matchNeighbours } from "../../../lib/neighbours"
import { competitionQuery, matchGamesQuery } from "../../../lib/tournament-api"
import { useNow } from "../../../lib/use-now"
import { matchHeadOf, seriesHeadOf } from "./match-head"
import { matchStatus } from "./match-row"

/** How often the games of a match that is on now are read again. */
const LIVE = 60_000

/** A match read from its competition's plan, or from its games when it is opened by its series alone. */
export function useMatch() {
  const { languageTag } = useStreamLocale()
  const now = useNow()
  const { id, matchKey, seriesId } = useParams()
  const competition = useQuery({ ...competitionQuery(id || ""), enabled: !!id })
  const planned = useMemo(
    () => competition.data && competitionMatches([competition.data]).find((entry) => entry.match.key === matchKey),
    [competition.data, matchKey],
  )
  const linkedSeriesId = seriesId || (planned && matchSeriesId(planned))
  const games = useQuery(matchGamesQuery(linkedSeriesId))
  const first = games.data?.[0]
  const linked = useQuery({ ...competitionQuery(first?.series.tournamentId || ""), enabled: !id && !!first })
  const found = useMemo(
    () => (linked.data && seriesId ? findSeriesMatch(linked.data, seriesId) : undefined),
    [linked.data, seriesId],
  )
  const entry = planned || found
  const live = !!entry && matchStatus(entry, now) === "LIVE"
  // The same games once more, as whether the match is on is only known from them where it is opened by its series.
  useQuery({ ...matchGamesQuery(linkedSeriesId), refetchInterval: live && LIVE })
  const series = entry ? entry.competition.content.series[matchSeriesId(entry) || ""] : first?.series
  const list = useMemo(
    () => (linkedSeriesId ? orderedMatchGames(games.data || [], linkedSeriesId) : []),
    [games.data, linkedSeriesId],
  )
  const beside = useMemo(
    () => (entry ? matchNeighbours(competitionMatches([entry.competition]), entry.match.key) : null),
    [entry],
  )
  return {
    entry,
    live,
    beside,
    series,
    games,
    list,
    linkedSeriesId,
    loading: id ? competition.isPending : games.isPending,
    retry: () => void (id ? competition.refetch() : games.refetch()),
    tournamentId: id || first?.series.tournamentId,
    competitionName: entry?.competition.content.tournament.name || first?.tournament.name,
    head: entry ? matchHeadOf(entry, languageTag) : first ? seriesHeadOf(first, languageTag) : null,
    scheduledAt: entry ? entry.match.scheduledAt : first?.series.scheduledAt,
    overview: entry
      ? competitionMatchHref(entry.competition.id, entry.match.key)
      : `/matches/${encodeURIComponent(linkedSeriesId || "")}`,
  }
}

export type Match = ReturnType<typeof useMatch>
