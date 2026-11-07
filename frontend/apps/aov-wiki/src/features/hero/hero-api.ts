import { queryOptions } from "@tanstack/react-query"
import type { MediaCredit } from "@aov/ui/lib/media-credit"
import type { HeroPosition, HeroRole } from "./hero-classifications"
import { wikiCatalogParameters, wikiScopeKey, type WikiCatalogScope } from "../../lib/wiki-catalog"
import { FocalPoint } from "@aov/ui/lib/focal-point"

export interface HeroMedia {
  assetId: string
  semanticType: string
  currentVersion?: {
    versionId: string
    url: string
    focalPoint?: FocalPoint | null
    width?: number
    height?: number
    sources?: MediaCredit[]
  }
}

export interface HeroListItem {
  unscopedBaseline?: boolean
  id: string
  code: string
  revisionId: string
  name: string
  actualLocale: string
  roles: HeroRole[]
  positions?: HeroPosition[]
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

export interface PublicSkill {
  skillKey: string
  name?: string | null
  description?: string | null
  kind: "PASSIVE" | "ACTIVE" | "OTHER"
  displayOrder: number
  effects?: {
    effectType: string
    metadata?: {
      sourceSlot?: string | number
      sourceHeroCode?: string
      reviewFlags?: { type?: string }[]
      heroReviewFlags?: { type?: string }[]
      tags?: string
      cooldown?: { display?: string }
      energyCost?: { display?: string }
      levelTable?: {
        column_labels?: string[]
        rows?: { label?: string; display_values?: (string | number | null)[] }[]
      }
    } | null
  }[]
}

export interface HeroDetail {
  unscopedBaseline?: boolean
  id: string
  code: string
  revisionId: string
  context: HeroContext
  media: Partial<Record<"HEAD" | "PORTRAIT" | "SPLASH", HeroMedia>>
  skillMedia?: Record<string, HeroMedia>
  content: {
    profile?: { name: string; roles: HeroRole[]; title?: string | null; summary?: string | null; lore?: string | null }
    overviewRatings?: {
      scaleCode?: string | null
      survivability?: number | null
      attackDamage?: number | null
      skillEffects?: number | null
      difficulty?: number | null
    } | null
    skills?: { skills?: PublicSkill[] } | null
    combatStats?: {
      values?: { statKey: string; baseValue: number | null; percentValue?: number | null; unit?: string }[]
    } | null
  }
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
