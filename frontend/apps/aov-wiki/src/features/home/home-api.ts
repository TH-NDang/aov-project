import { queryOptions } from "@tanstack/react-query"
import { wikiCatalogParameters, type WikiCatalogScope } from "../../lib/wiki-catalog"

export interface SeasonPatch {
  id: string
  code: string
  title: string | null
  summary: string | null
  actualLocale: string | null
  effectiveAt: string | null
  effectiveOn: string | null
  sourceUrl: string | null
  isCurrent: boolean
}

export interface SeasonUpdates {
  region: string
  requestedLocale: string
  asOf: string
  season: { id: string; code: string; displayName: string } | null
  currentPatchId: string | null
  patches: SeasonPatch[]
}

export const seasonUpdatesQuery = (scope: WikiCatalogScope) =>
  queryOptions({
    queryKey: ["wiki", "season-updates", scope.region, scope.locale],
    queryFn: async ({ signal }): Promise<SeasonUpdates> => {
      const response = await fetch(
        `/api/wiki/v1/seasons/current/updates?${wikiCatalogParameters(scope, false)}&limit=4`,
        {
          signal,
          credentials: "omit",
        },
      )
      if (!response.ok) throw new Error("Season updates are unavailable.")
      return response.json()
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  })
