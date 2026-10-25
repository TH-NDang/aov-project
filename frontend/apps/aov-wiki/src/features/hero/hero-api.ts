import { queryOptions } from "@tanstack/react-query"
import type { HeroRole } from "./hero-classifications"

export interface HeroMedia {
  assetId: string
  semanticType: string
  currentVersion?: { versionId: string; url: string; width?: number; height?: number }
}

export interface HeroListItem {
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

export const heroCatalogQuery = queryOptions({
  queryKey: ["wiki", "heroes", "VN", "vi-VN"],
  queryFn: async ({ signal }) => {
    const first = await readHeroApi<HeroPage>("/heroes?region=VN&locale=vi-VN&size=100&page=0", signal)
    const items = [...first.items]
    for (let page = 1; page < first.totalPages; page++) {
      const next = await readHeroApi<HeroPage>(`/heroes?region=VN&locale=vi-VN&size=100&page=${page}`, signal)
      items.push(...next.items)
    }
    return { context: first.context, items }
  },
  staleTime: 60_000,
  retry: 1,
})

export function heroDetailQuery(heroId: string) {
  return queryOptions({
    queryKey: ["wiki", "hero", heroId, "VN", "vi-VN"],
    queryFn: ({ signal }) =>
      readHeroApi<HeroDetail>(`/heroes/${encodeURIComponent(heroId)}?region=VN&locale=vi-VN`, signal),
    staleTime: 60_000,
    retry: 1,
  })
}
