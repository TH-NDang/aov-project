import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"
import type {
  CompetitionView,
  PageSlice,
  PublishedGame,
  TournamentContent,
  SeriesContent,
} from "@aov/community-contracts"
import { streamText } from "../../components/stream-locale"

export interface PublishedSummary<T> {
  id: string
  content: T
  gameCount: number
}
async function read<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/community/v1${path}`, { signal, credentials: "omit" })
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? streamText("Không tìm thấy nội dung đã xuất bản.", "This published content could not be found.")
        : streamText("Chưa kết nối được kho dữ liệu giải đấu.", "The tournament data store could not be reached."),
    )
  return response.json()
}

/** Read every public page so filtering and match grouping never silently omit later pages. */
async function readPages<T>(path: string, signal: AbortSignal): Promise<T[]> {
  const items: T[] = []
  for (let page = 0; ; page += 1) {
    const result = await read<PageSlice<T>>(`${path}${path.includes("?") ? "&" : "?"}page=${page}&size=50`, signal)
    items.push(...result.items)
    if (!result.items.length || (result.page + 1) * result.size >= result.totalElements) return items
  }
}

export const competitionCatalogQuery = queryOptions({
  queryKey: ["competition-catalog"],
  queryFn: ({ signal }) => readPages<CompetitionView>("/competitions", signal),
  staleTime: 60_000,
  retry: 1,
})

export const competitionQuery = (id: string) =>
  queryOptions({
    queryKey: ["competition", id],
    queryFn: ({ signal }) => read<CompetitionView>(`/competitions/${encodeURIComponent(id)}`, signal),
    staleTime: 60_000,
    retry: 1,
  })

export const matchGamesQuery = (seriesId?: string | null) =>
  queryOptions({
    queryKey: ["match-games", seriesId],
    queryFn: ({ signal }) => readPages<PublishedGame>(`/games?seriesId=${encodeURIComponent(seriesId!)}`, signal),
    enabled: !!seriesId,
    staleTime: 60_000,
    retry: 1,
  })
export function gamesQuery(filters: { tournamentId?: string; seriesId?: string } = {}) {
  return infiniteQueryOptions({
    queryKey: ["community", "games", filters],
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
    queryKey: ["community", "game", id],
    queryFn: ({ signal }) => read<PublishedGame>(`/games/${encodeURIComponent(id)}`, signal),
    staleTime: 60_000,
    retry: 1,
  })
export const tournamentsQuery = queryOptions({
  queryKey: ["community", "tournaments"],
  queryFn: ({ signal }) => read<PageSlice<PublishedSummary<TournamentContent>>>("/tournaments?size=100", signal),
  staleTime: 60_000,
  retry: 1,
})
export const seriesQuery = (tournamentId?: string) =>
  queryOptions({
    queryKey: ["community", "series", tournamentId],
    queryFn: ({ signal }) =>
      read<PageSlice<PublishedSummary<SeriesContent>>>(
        `/series?${new URLSearchParams({ size: "100", ...(tournamentId ? { tournamentId } : {}) })}`,
        signal,
      ),
    staleTime: 60_000,
    retry: 1,
  })
