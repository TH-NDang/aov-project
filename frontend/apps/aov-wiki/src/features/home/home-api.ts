import { queryOptions } from "@tanstack/react-query"
import { wikiCatalogParameters, type WikiCatalogScope } from "../../lib/wiki-catalog"
import { wikiGet } from "../../lib/wiki-api"
import type { SkinCatalog } from "../../lib/skin-api"

/** Every query key of the home page; reads and invalidation both use these. */
export const homeKeys = {
  seasonUpdates: (scope: WikiCatalogScope) => ["wiki", "season-updates", scope.region, scope.locale] as const,
  modesOpen: ["wiki", "home", "modes-open"] as const,
  skinSample: (scope: WikiCatalogScope) => ["wiki", "home", "skin-sample", scope.region, scope.locale] as const,
}

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
    queryKey: homeKeys.seasonUpdates(scope),
    queryFn: ({ signal }) =>
      wikiGet<SeasonUpdates>(`/seasons/current/updates?${wikiCatalogParameters(scope, false)}&limit=4`, signal),
    meta: { storedAnswer: "wiki-season-updates@1" },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  })

/** Whether any game mode is published; the home page leaves the modes tile out until one is. */
export const modesOpenQuery = () =>
  queryOptions({
    queryKey: homeKeys.modesOpen,
    queryFn: async ({ signal }) => (await wikiGet<{ items: unknown[] }>("/game-modes", signal)).items.length > 0,
    staleTime: 5 * 60_000,
    retry: 1,
  })

/** One small page of skins, for their artwork on the home page without loading the whole collection. */
export const skinSampleQuery = (scope: WikiCatalogScope) =>
  queryOptions({
    queryKey: homeKeys.skinSample(scope),
    queryFn: async ({ signal }) => {
      const query = wikiCatalogParameters(scope, false)
      query.set("page", "0")
      query.set("size", "40")
      return (await wikiGet<SkinCatalog>(`/skins?${query}`, signal)).page.items
    },
    staleTime: 5 * 60_000,
    retry: 0,
  })
