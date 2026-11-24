import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"
import type {
  CompetitionView,
  CompetitionParticipant,
  PageSlice,
  PublishedGame,
  TournamentContent,
} from "@aov/community-contracts"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { communityGetAll, communityRequest } from "./stream-api"

export interface PublishedSummary<T> {
  id: string
  content: T
  gameCount: number
}
/** Every query key of tournaments; reads and invalidation both use these. */
export const tournamentKeys = {
  catalog: ["competition-catalog"] as const,
  competition: (id: string) => ["competition", id] as const,
  teamCompetitions: (id: string) => ["team-competitions", id] as const,
  playerCompetitions: (id: string) => ["player-competitions", id] as const,
  personCompetitions: (id: string) => ["person-competitions", id] as const,
  participants: (kind: string, q: string, size: number) => ["participants", kind, q, size] as const,
  seriesGames: (seriesId: string | null | undefined) => ["match-games", seriesId] as const,
  games: (filters: { tournamentId?: string; seriesId?: string }) => ["community", "games", filters] as const,
  game: (id: string) => ["community", "game", id] as const,
  tournaments: ["community", "tournaments"] as const,
}

const read = <T>(path: string, signal: AbortSignal) => communityRequest<T>(path, { signal })

/** Read every public page so filtering and match grouping never silently omit later pages. */
const readPages = <T>(path: string, signal: AbortSignal) => communityGetAll<T>(path, { signal })

/**
 * Every competition as the lists show it. Series, rosters, players and people are left out of it, which is two thirds
 * of the data; the page of a competition reads them with the competition.
 */
export const competitionCatalogQuery = queryOptions({
  queryKey: tournamentKeys.catalog,
  queryFn: ({ signal }) => readPages<CompetitionView>("/competitions?detail=LIST", signal),
  staleTime: 60_000,
  retry: 1,
})

export const competitionQuery = (id: string) =>
  queryOptions({
    queryKey: tournamentKeys.competition(id),
    queryFn: ({ signal }) => read<CompetitionView>(`/competitions/${encodeURIComponent(id)}`, signal),
    staleTime: 60_000,
    retry: 1,
  })

/** Every published competition of a team, as the lists show it. */
export const teamCompetitionsQuery = (id: string) =>
  queryOptions({
    queryKey: tournamentKeys.teamCompetitions(id),
    queryFn: ({ signal }) =>
      readPages<CompetitionView>(`/competitions?detail=LIST&teamId=${encodeURIComponent(id)}`, signal),
    staleTime: 60_000,
    retry: 1,
  })

/** Every published competition that registered a player, whole: the rosters say with which team. */
export const playerCompetitionsQuery = (id: string) =>
  queryOptions({
    queryKey: tournamentKeys.playerCompetitions(id),
    queryFn: ({ signal }) => readPages<CompetitionView>(`/competitions?playerId=${encodeURIComponent(id)}`, signal),
    staleTime: 60_000,
    retry: 1,
  })

/** Every published competition that names a person in its broadcast or its teams' staff, whole. */
export const personCompetitionsQuery = (pageId: string) =>
  queryOptions({
    queryKey: tournamentKeys.personCompetitions(pageId),
    queryFn: ({ signal }) =>
      readPages<CompetitionView>(`/competitions?personPageId=${encodeURIComponent(pageId)}`, signal),
    staleTime: 60_000,
    retry: 1,
  })

/** Who takes part in published competitions, for a list that keeps loading as the reader scrolls. */
export const participantsQuery = (kind: CompetitionParticipant["kind"], q = "", size = 24) =>
  infiniteQueryOptions({
    queryKey: tournamentKeys.participants(kind, q, size),
    initialPageParam: 0,
    queryFn: ({ signal, pageParam }) =>
      read<PageSlice<CompetitionParticipant>>(
        `/competitions/participants?${new URLSearchParams({ kind, ...(q ? { q } : {}), page: String(pageParam), size: String(size) })}`,
        signal,
      ),
    getNextPageParam: nextPageOf,
    staleTime: 60_000,
    retry: 1,
  })

export const matchGamesQuery = (seriesId?: string | null) =>
  queryOptions({
    queryKey: tournamentKeys.seriesGames(seriesId),
    queryFn: ({ signal }) => readPages<PublishedGame>(`/games?seriesId=${encodeURIComponent(seriesId!)}`, signal),
    enabled: !!seriesId,
    staleTime: 60_000,
    retry: 1,
  })
export function gamesQuery(filters: { tournamentId?: string; seriesId?: string } = {}) {
  return infiniteQueryOptions({
    queryKey: tournamentKeys.games(filters),
    initialPageParam: 0,
    queryFn: ({ signal, pageParam }) => {
      const params = new URLSearchParams({ page: String(pageParam), size: "12" })
      for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
      return read<PageSlice<PublishedGame>>(`/games?${params}`, signal)
    },
    getNextPageParam: (last) => ((last.page + 1) * last.size < last.totalElements ? last.page + 1 : undefined),
    staleTime: 60_000,
    retry: 1,
  })
}
export const gameQuery = (id: string) =>
  queryOptions({
    queryKey: tournamentKeys.game(id),
    queryFn: ({ signal }) => read<PublishedGame>(`/games/${encodeURIComponent(id)}`, signal),
    staleTime: 60_000,
    retry: 1,
  })
export const tournamentsQuery = queryOptions({
  queryKey: tournamentKeys.tournaments,
  queryFn: async ({ signal }) => ({
    items: await readPages<PublishedSummary<TournamentContent>>("/tournaments", signal),
  }),
  staleTime: 60_000,
  retry: 1,
})
