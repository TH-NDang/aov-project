import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query"
import type { HeroMedia } from "../hero/hero-api"
import { wikiCatalogParameters, wikiScopeKey, type WikiCatalogScope } from "../../lib/wiki-catalog"

export interface SkinBadge {
  code: string
  name: string
  actualLocale: string
  icon?: HeroMedia
}

export interface SkinEntry {
  unscopedBaseline?: boolean
  heroId: string
  heroCode: string
  heroName: string
  heroHead?: HeroMedia
  skinKey: string
  name: string
  actualLocale: string
  rarityCode?: string
  badge?: SkinBadge
  portrait?: HeroMedia
  head?: HeroMedia
  art?: HeroMedia
}

export interface SkinFilterOption {
  code: string
  name: string
}

export interface SkinCatalog {
  page: { items: SkinEntry[]; page: number; size: number; totalElements: number }
  heroes: SkinFilterOption[]
  rarities: SkinFilterOption[]
}

export interface SkinFilters {
  q: string
  hero: string
  rarity: string
}

export function skinCatalogQuery(filters: SkinFilters, scope: WikiCatalogScope) {
  return infiniteQueryOptions({
    queryKey: ["wiki", "skins", ...wikiScopeKey(scope), filters] as const,
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }): Promise<SkinCatalog> => {
      const query = wikiCatalogParameters(scope)
      query.set("page", String(pageParam))
      query.set("size", "24")
      for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value)

      const response = await fetch(`/api/wiki/v1/skins?${query}`, { signal, credentials: "omit" })
      if (!response.ok) throw new Error("Published skins are unavailable.")
      return response.json()
    },
    getNextPageParam: ({ page }) => ((page.page + 1) * page.size < page.totalElements ? page.page + 1 : undefined),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: 1,
  })
}
