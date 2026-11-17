import { queryOptions } from "@tanstack/react-query"
import { wikiCatalogParameters, type WikiCatalogScope } from "../../lib/wiki-catalog"
import { wikiGet } from "../../lib/wiki-api"

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
    queryFn: ({ signal }) =>
      wikiGet<SeasonUpdates>(`/seasons/current/updates?${wikiCatalogParameters(scope, false)}&limit=4`, signal),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  })

const COUNTED = ["skins", "items", "enchantments", "arcana", "spells"] as const
export type CountedSection = (typeof COUNTED)[number]

/**
 * How many published entries each catalog holds, read from the total of a one-row page. A catalog that fails to
 * answer is left out, so its tile simply shows no number.
 */
export const sectionCountsQuery = (scope: WikiCatalogScope) =>
  queryOptions({
    queryKey: ["wiki", "section-counts", scope.region, scope.locale],
    queryFn: async ({ signal }) => {
      const totals = await Promise.all(
        COUNTED.map(async (section) => {
          try {
            const query = wikiCatalogParameters(scope, false)
            query.set("page", "0")
            query.set("size", "1")
            const body = await wikiGet<{ totalElements?: number; page?: { totalElements?: number } }>(
              `/${section}?${query}`,
              signal,
            )
            return body.totalElements ?? body.page?.totalElements
          } catch {
            return undefined
          }
        }),
      )
      return Object.fromEntries(COUNTED.map((section, index) => [section, totals[index]])) as Partial<
        Record<CountedSection, number>
      >
    },
    staleTime: 5 * 60_000,
    retry: 0,
  })
