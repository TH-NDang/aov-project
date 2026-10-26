import { queryOptions } from "@tanstack/react-query"
import type { HeroRole } from "./hero-classifications"
import { wikiCatalogParameters, wikiScopeKey, type WikiCatalogScope } from "../../lib/wiki-catalog"

export interface HeroMedia {
  assetId: string
  semanticType: string
  currentVersion?: { versionId: string; url: string; width?: number; height?: number }
}

export interface HeroListItem {
  unscopedBaseline?: boolean
  id: string
  code: string
  revisionId: string
  name: string
  actualLocale: string
  roles: HeroRole[]
  head?: HeroMedia
  portrait?: HeroMedia
}

interface HeroContext {
  region: string
  requestedLocale: string
  patch: { id: string; code: string }
  ruleset: { id: string; code: string }
}

interface HeroPage {
  context: HeroContext
  items: HeroListItem[]
  totalPages: number
}

export interface HeroDetail {
  unscopedBaseline?: boolean
  id: string
  code: string
  revisionId: string
  context: HeroContext
  media: Partial<Record<"HEAD" | "PORTRAIT" | "SPLASH", HeroMedia>>
  content: { profile: { name: string; roles: HeroRole[] } }
}

async function readHeroApi<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/wiki/v1${path}`, { signal, credentials: "omit" })
  if (!response.ok) throw new Error("Published hero data is unavailable.")
  return response.json()
}

export const heroCatalogQuery = (scope: WikiCatalogScope) =>
  queryOptions({
    queryKey: ["wiki", "heroes", ...wikiScopeKey(scope)],
    queryFn: async ({ signal }) => {
      const params = wikiCatalogParameters(scope)
      params.set("size", "100")
      params.set("page", "0")
      const first = await readHeroApi<HeroPage>(`/heroes?${params}`, signal)
      const items = [...first.items]
      for (let page = 1; page < first.totalPages; page++) {
        params.set("page", String(page))
        const next = await readHeroApi<HeroPage>(`/heroes?${params}`, signal)
        items.push(...next.items)
      }
      return { context: first.context, items }
    },
    staleTime: 60_000,
    retry: 1,
  })

export function heroDetailQuery(heroId: string, scope: WikiCatalogScope) {
  return queryOptions({
    queryKey: ["wiki", "hero", heroId, ...wikiScopeKey(scope)],
    queryFn: ({ signal }) =>
      readHeroApi<HeroDetail>(`/heroes/${encodeURIComponent(heroId)}?${wikiCatalogParameters(scope)}`, signal),
    staleTime: 60_000,
    retry: 1,
  })
}
