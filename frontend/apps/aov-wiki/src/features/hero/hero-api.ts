import { queryOptions } from "@tanstack/react-query"
import type { MediaCredit } from "@aov/ui/lib/media-credit"
import type { HeroPosition, HeroRole } from "./hero-classifications"
import { wikiCatalogParameters, wikiScopeKey, type WikiCatalogScope } from "../../lib/wiki-catalog"
import { FocalPoint } from "@aov/ui/lib/focal-point"
import { wikiGet, wikiGetPages } from "../../lib/wiki-api"

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

/** Set when the selected patch has no observation of the hero yet and its data comes from a later patch. */
export interface HeroLaterObservation {
  patchVariantId: string
  patchCode: string
}

export interface HeroListItem {
  unscopedBaseline?: boolean
  laterObservation?: HeroLaterObservation
  id: string
  code: string
  revisionId: string
  name: string
  actualLocale: string
  roles: HeroRole[]
  positions?: HeroPosition[]
  head?: HeroMedia
  portrait?: HeroMedia
  /** The published forms of a hero that holds forms, default form first (ADR-024). */
  forms?: HeroListForm[]
}

/** One form inside a hero's list entry: what the switcher and the library need without loading the form. */
export interface HeroListForm {
  unscopedBaseline?: boolean
  laterObservation?: HeroLaterObservation
  id: string
  code: string
  formKey: string
  revisionId: string
  name: string
  actualLocale: string
  roles: HeroRole[]
  positions?: HeroPosition[]
  head?: HeroMedia
  portrait?: HeroMedia
}

/** Where a form sits when it is read on its own, so readers can be sent to the hero that holds it. */
export interface HeroFormParent {
  id: string
  code: string
  formKey: string
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
  totalElements: number
}

export interface PublicSkill {
  skillKey: string
  /** The name of the variant's form, when the slot has several. */
  formKey?: string | null
  /** Pictures the skill takes in a state; the text stays the skill's own. */
  stateIcons?: { assetId: string; label: string }[]
  name?: string | null
  description?: string | null
  /** A short plain text beside the description, written for readers new to the game; absent until an editor writes it. */
  summary?: string | null
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
  laterObservation?: HeroLaterObservation
  id: string
  code: string
  revisionId: string
  context: HeroContext
  media: Partial<Record<"HEAD" | "PORTRAIT" | "SPLASH", HeroMedia>>
  skillMedia?: Record<string, HeroMedia>
  /** State pictures by asset ID, as listed under each skill's `stateIcons`. */
  skillStateMedia?: Record<string, HeroMedia>
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
  /** Each published form of a hero that holds forms, with the same detail as a hero (ADR-024). */
  forms?: HeroFormDetail[]
  /** Set when this hero is a form of another hero. */
  parent?: HeroFormParent
}

export type HeroFormDetail = Omit<HeroDetail, "context" | "forms" | "parent"> & {
  formKey: string
  displayOrder: number
  actualLocale?: string
}

export const heroCatalogQuery = (scope: WikiCatalogScope) =>
  queryOptions({
    queryKey: ["wiki", "heroes", ...wikiScopeKey(scope)],
    queryFn: async ({ signal }) => {
      const { first, items } = await wikiGetPages<HeroPage, HeroListItem>(
        "/heroes",
        wikiCatalogParameters(scope),
        signal,
        { size: 100, items: (page) => page.items, total: (page) => page.totalElements },
      )
      return { context: first.context, items }
    },
    staleTime: 60_000,
    retry: 1,
  })

export function heroDetailQuery(heroId: string, scope: WikiCatalogScope) {
  return queryOptions({
    queryKey: ["wiki", "hero", heroId, ...wikiScopeKey(scope)],
    queryFn: ({ signal }) =>
      wikiGet<HeroDetail>(`/heroes/${encodeURIComponent(heroId)}?${wikiCatalogParameters(scope)}`, signal),
    staleTime: 60_000,
    retry: 1,
  })
}

/** The hero in the latest confirmed ranked snapshot of the game's boards (ADR-025, ADR-029). */
export interface HeroRankingReading {
  snapshot: {
    code: string
    regionCode: string
    modeCode: string
    modeLabel: string
    periodLabel: string | null
    capturedAt: string
    sourceTimeZone: string | null
    heroes: number
  } | null
  entry: {
    heroId: string
    heroCode: string
    tier: string | null
    winRate: number | null
    pickRate: number | null
    banRate: number | null
    figures: { metric: string; value: number | null; rank: number | null; of: number }[]
    counters: { heroId: string | null; heroCode: string }[]
  } | null
}

/** Every hero that has each kit trait in a market, so a trait can list the other heroes that share it. */
export interface HeroTraitIndex {
  region: string
  traits: { code: string; heroes: { id: string; code: string }[] }[]
}

export function heroRankingQuery(heroId: string, region: string) {
  return queryOptions({
    queryKey: ["wiki", "hero-ranking", heroId, region] as const,
    queryFn: ({ signal }) =>
      wikiGet<HeroRankingReading>(
        `/heroes/${encodeURIComponent(heroId)}/ranking?region=${encodeURIComponent(region)}`,
        signal,
      ),
    staleTime: 300_000,
    retry: false,
  })
}

export function heroTraitIndexQuery(region: string) {
  return queryOptions({
    queryKey: ["wiki", "hero-traits", region] as const,
    queryFn: ({ signal }) => wikiGet<HeroTraitIndex>(`/hero-traits?region=${encodeURIComponent(region)}`, signal),
    staleTime: 300_000,
    retry: false,
  })
}
