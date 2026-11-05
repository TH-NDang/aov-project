import { queryOptions } from "@tanstack/react-query"
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

export function skinCatalogQuery(scope: WikiCatalogScope) {
  return queryOptions({
    queryKey: ["wiki", "skin-collection", ...wikiScopeKey(scope)] as const,
    queryFn: async ({ signal }) => {
      const query = wikiCatalogParameters(scope)
      query.set("size", "60")
      async function readPage(page: number): Promise<SkinCatalog> {
        const response = await fetch(`/api/wiki/v1/skins?${query}&page=${page}`, { signal, credentials: "omit" })
        if (!response.ok) throw new Error("Published skins are unavailable.")
        return response.json()
      }
      const first = await readPage(0)
      const items = [...first.page.items]
      const pages = Math.ceil(first.page.totalElements / first.page.size)
      for (let page = 1; page < pages; page += 3) {
        const batch = await Promise.all(Array.from({ length: Math.min(3, pages - page) }, (_, i) => readPage(page + i)))
        for (const result of batch) items.push(...result.page.items)
      }
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
