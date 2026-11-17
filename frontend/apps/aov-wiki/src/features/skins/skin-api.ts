import { queryOptions } from "@tanstack/react-query"
import type { HeroMedia } from "../hero/hero-api"
import { wikiCatalogParameters, wikiScopeKey, type WikiCatalogScope } from "../../lib/wiki-catalog"
import { wikiGetPages } from "../../lib/wiki-api"

/** Every query key of skins; reads and invalidation both use these. */
export const skinKeys = {
  collection: (scope: WikiCatalogScope) => ["wiki", "skin-collection", ...wikiScopeKey(scope)] as const,
  hero: (heroCode: string, scope: WikiCatalogScope) =>
    ["wiki", "hero-skins", heroCode, ...wikiScopeKey(scope)] as const,
}

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

const SKIN_PAGE_SIZE = 60

const readSkinPages = (query: URLSearchParams, signal: AbortSignal) =>
  wikiGetPages<SkinCatalog, SkinEntry>("/skins", query, signal, {
    size: SKIN_PAGE_SIZE,
    items: (page) => page.page.items,
    total: (page) => page.page.totalElements,
    parallel: 3,
  })

export function skinCatalogQuery(scope: WikiCatalogScope) {
  return queryOptions({
    queryKey: skinKeys.collection(scope),
    queryFn: async ({ signal }) => {
      const query = wikiCatalogParameters(scope)
      const { first, items } = await readSkinPages(query, signal)
      const heads = new Map<string, string>()
      const badges = new Map<string, string>()
      for (const skin of items) {
        const head = skin.heroHead?.currentVersion?.url
        const badge = skin.badge
        if (head) heads.set(skin.heroCode, head)
        if (badge?.icon?.currentVersion?.url) badges.set(badge.code, badge.icon.currentVersion.url)
      }
      return {
        items,
        heroes: first.heroes.map((option) => ({ ...option, image: heads.get(option.code) })),
        rarities: first.rarities.map((option) => ({ ...option, image: badges.get(option.code) })),
      }
    },
    staleTime: 60_000,
    retry: 1,
  })
}

/** One hero's skins, for showing them on the hero page without loading the whole collection. */
export function heroSkinsQuery(scope: WikiCatalogScope, heroCode: string) {
  return queryOptions({
    queryKey: skinKeys.hero(heroCode, scope),
    queryFn: async ({ signal }) => {
      const query = wikiCatalogParameters(scope)
      query.set("hero", heroCode)
      return (await readSkinPages(query, signal)).items
    },
    staleTime: 60_000,
    retry: 1,
  })
}
