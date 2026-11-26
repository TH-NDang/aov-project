import { queryOptions } from "@tanstack/react-query"
import { wikiCatalogParameters, type WikiCatalogScope } from "./wiki-catalog"
import { wikiGet } from "./wiki-api"

/** Every query key of the section counts; reads and invalidation both use these. */
export const sectionCountKeys = {
  all: (scope: WikiCatalogScope) => ["wiki", "section-counts", scope.region, scope.locale] as const,
}

const COUNTED = ["skins", "items", "enchantments", "arcana", "spells"] as const
export type CountedSection = (typeof COUNTED)[number]

/**
 * How many published entries each catalog holds, read from the total of a one-row page. A catalog that fails to
 * answer is left out, so its tile simply shows no number.
 */
export const sectionCountsQuery = (scope: WikiCatalogScope) =>
  queryOptions({
    queryKey: sectionCountKeys.all(scope),
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
