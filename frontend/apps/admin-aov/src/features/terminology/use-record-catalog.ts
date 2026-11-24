import { useInfiniteQuery, useQueries } from "@tanstack/react-query"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { recordCatalogApi, recordCatalogKeys, recordKinds, type RecordKind } from "./record-catalog-api"

/** How many records of each kind a search finds; a kind still being counted has no number. */
export function useRecordCounts(search: string, enabled: boolean) {
  const counts = useQueries({
    queries: recordKinds.map((kind) => ({
      queryKey: recordCatalogKeys.count(kind, search),
      queryFn: ({ signal }: { signal: AbortSignal }) => recordCatalogApi.count(kind, search, signal),
      staleTime: 60_000,
      enabled,
    })),
  })
  return new Map(recordKinds.map((kind, index) => [kind, counts[index]?.data]))
}

/** The records of one kind, read page by page. */
export function useRecordCatalog(kind: RecordKind, search: string) {
  return useInfiniteQuery({
    queryKey: recordCatalogKeys.rows(kind, search),
    queryFn: ({ pageParam, signal }) => recordCatalogApi.list(kind, search, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: nextPageOf,
    staleTime: 60_000,
  })
}
