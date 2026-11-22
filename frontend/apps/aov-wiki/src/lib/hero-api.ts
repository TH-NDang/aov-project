import { queryOptions } from "@tanstack/react-query"
import type { MediaCredit } from "@aov/ui/lib/media-credit"
import type { HeroPosition, HeroRole } from "./hero-classifications"
import { wikiCatalogParameters, wikiScopeKey, type WikiCatalogScope } from "./wiki-catalog"
import { FocalPoint } from "@aov/ui/lib/focal-point"
import { wikiGet, wikiGetPages } from "./wiki-api"

/** Every query key of the hero feature; reads and invalidation both use these. */
export const heroKeys = {
  catalog: (scope: WikiCatalogScope) => ["wiki", "heroes", ...wikiScopeKey(scope)] as const,
  detail: (heroId: string, scope: WikiCatalogScope) => ["wiki", "hero", heroId, ...wikiScopeKey(scope)] as const,
  ranking: (heroId: string, region: string) => ["wiki", "hero-ranking", heroId, region] as const,
  rankings: (region: string) => ["wiki", "hero-rankings", region] as const,
  traits: (region: string) => ["wiki", "hero-traits", region] as const,
  builds: (heroCode: string, region: string) => ["wiki", "hero-builds", heroCode, region] as const,
  shop: (heroId: string, region: string) => ["wiki", "hero-shop", heroId, region] as const,
}

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
  /** The difficulty of the hero profile's summary ratings, on the game's ten-point scale. */
  difficulty?: number | null
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
  page: { items: HeroListItem[]; totalElements: number }
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

export interface HeroCatalog {
  context: HeroPage["context"]
  items: HeroListItem[]
}

/** Every published hero. The last answer is kept in the browser, so a returning reader sees the list at once. */
export const heroCatalogQuery = (scope: WikiCatalogScope) =>
  queryOptions({
    queryKey: heroKeys.catalog(scope),
    queryFn: async ({ signal }): Promise<HeroCatalog> => {
      const { first, items } = await wikiGetPages<HeroPage, HeroListItem>(
        "/heroes",
        wikiCatalogParameters(scope),
        signal,
        // The game has more heroes than one page holds, so the second page is asked for beside the first.
        { size: 100, items: (list) => list.page.items, total: (list) => list.page.totalElements, ahead: 1 },
      )
      return { context: first.context, items }
    },
    meta: { storedAnswer: "wiki-heroes@1" },
    staleTime: 60_000,
    retry: 1,
  })

export function heroDetailQuery(heroId: string, scope: WikiCatalogScope) {
  return queryOptions({
    queryKey: heroKeys.detail(heroId, scope),
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
    queryKey: heroKeys.ranking(heroId, region),
    queryFn: ({ signal }) =>
      wikiGet<HeroRankingReading>(
        `/heroes/${encodeURIComponent(heroId)}/ranking?region=${encodeURIComponent(region)}`,
        signal,
      ),
    staleTime: 300_000,
    retry: false,
  })
}

/** Every hero's place in the latest confirmed ranked snapshot of a market, for ordering the library. */
export interface HeroRankingBoard {
  snapshot: HeroRankingReading["snapshot"]
  entries: {
    heroId: string
    heroCode: string
    tier: string | null
    winRate: number | null
    pickRate: number | null
    banRate: number | null
  }[]
}

export function heroRankingBoardQuery(region: string) {
  return queryOptions({
    queryKey: heroKeys.rankings(region),
    queryFn: ({ signal }) => wikiGet<HeroRankingBoard>(`/hero-rankings?region=${encodeURIComponent(region)}`, signal),
    staleTime: 300_000,
    retry: false,
  })
}

export function heroTraitIndexQuery(region: string) {
  return queryOptions({
    queryKey: heroKeys.traits(region),
    queryFn: ({ signal }) => wikiGet<HeroTraitIndex>(`/hero-traits?region=${encodeURIComponent(region)}`, signal),
    staleTime: 300_000,
    retry: false,
  })
}

export interface PublicBuild {
  contentKey: string
  positions: number[]
  items: { slot: number; itemId: string; code: string | null }[]
  enchantments: { slot: number; enchantmentId: string; code: string | null }[]
  arcanaPageId: string | null
  arcana: { arcanaId: string; code: string | null; quantity: number }[]
  arcanaPageUse: { builds: number; heroes: number } | null
  spellId: string | null
  spellCode: string | null
}

export interface BuildSource {
  captureId: string
  sourceKind: "PRO" | "HOT" | "SYSTEM"
  sourceLabel: string
  capturedAt: string
  sourceTimeZone: string
  patchCode: string | null
  result: "COLLECTED" | "NO_BUILDS" | "FAILED"
  builds: PublicBuild[]
}

export interface HeroBuildReading {
  heroId: string
  heroCode: string
  regionCode: string
  sources: BuildSource[]
}

export function heroBuildsQuery(heroCode: string, region: string) {
  return queryOptions({
    queryKey: heroKeys.builds(heroCode, region),
    queryFn: ({ signal }) =>
      wikiGet<HeroBuildReading>(`/builds?${new URLSearchParams({ hero: heroCode, region })}`, signal),
    staleTime: 300000,
    retry: false,
  })
}

export type HeroAvailability = "ON_SALE" | "NOT_OPEN" | "COMING_SOON" | "UNKNOWN"
export type SkinMethod = "VOUCHER" | "EVENT" | "NOT_OPEN" | "OTHER" | "UNKNOWN"

export interface HeroShop {
  price: {
    availability: HeroAvailability
    goldPrice: number | null
    voucherPrice: number | null
  } | null
  skins: { skinKey: string; method: SkinMethod; voucherPrice: number | null; eventName: string | null }[]
}

/**
 * Today's price and skin acquisition. A past patch on the hero page changes only the abilities (ADR-016), and prices
 * were only recorded recently, so an older day would mostly show nothing.
 */
export function heroShopQuery(heroId: string, region: string) {
  return queryOptions({
    queryKey: heroKeys.shop(heroId, region),
    queryFn: ({ signal }) => wikiGet<HeroShop>(`/heroes/${heroId}/shop?${new URLSearchParams({ region })}`, signal),
    staleTime: 300000,
    retry: false,
  })
}
