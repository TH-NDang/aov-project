import { queryOptions } from "@tanstack/react-query"
import { wikiGet } from "../lib/wiki-api"
import type { CatalogContextResponse, WikiRegion } from "./wiki-context"

/** Every query key of the browsing context; reads and invalidation both use these. */
export const wikiContextKeys = {
  regions: ["wiki", "regions"] as const,
  catalogContext: (region: string, locale: string) => ["wiki", "catalog-context", region, locale] as const,
}

/** The markets a reader can choose. */
export const regionsQuery = queryOptions({
  queryKey: wikiContextKeys.regions,
  queryFn: ({ signal }) => wikiGet<WikiRegion[]>("/regions", signal),
  staleTime: 300_000,
  retry: 1,
})

/** Seasons, patches and languages of one market. */
export const catalogContextQuery = (region: string, locale: string) =>
  queryOptions({
    queryKey: wikiContextKeys.catalogContext(region, locale),
    queryFn: ({ signal }) =>
      wikiGet<CatalogContextResponse>(`/catalog-context?${new URLSearchParams({ region, locale })}`, signal),
    staleTime: 60_000,
    retry: 1,
  })
