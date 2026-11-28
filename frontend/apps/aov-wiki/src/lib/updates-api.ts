import { queryOptions } from "@tanstack/react-query"
import { wikiCatalogParameters, type WikiCatalogScope } from "./wiki-catalog"
import type { PublishedChange } from "./published-change-subjects"
import type { HeroChangeItem } from "./wiki-change-format"
import type { ChangeDomain } from "./wiki-patch-changes"
import { wikiGetAll } from "./wiki-api"
import type { PatchSourceLink } from "./patch-sources"

/** Every query key of patch notes; reads and invalidation both use these. */
export const updateKeys = {
  releases: (scope: WikiCatalogScope) => ["wiki", "patch-releases", scope.region, scope.locale] as const,
  patchChanges: (scope: WikiCatalogScope, release: Pick<PatchRelease, "id" | "variantId">, domain: ChangeDomain) =>
    ["wiki", "patch-page-changes", scope.region, scope.locale, release.id, release.variantId, domain] as const,
  heroHistory: (scope: WikiCatalogScope, heroId: string) =>
    ["wiki", "hero-change-history", scope.region, scope.locale, heroId] as const,
}

export interface PatchRelease {
  id: string
  code: string
  sequence: number
  title: string | null
  summary: string | null
  description: string | null
  actualLocale: string | null
  variantId: string
  effectiveAt: string | null
  /** The pages of the official notes, each named by its language or market; older answers leave it out. */
  sources?: PatchSourceLink[]
  /** When each market gets the patch, ordered like the markets; older answers leave it out (ADR-038). */
  markets?: PatchMarketRelease[]
}

/** A market's release: an exact moment when the hour is known, else the day on the market's calendar. */
export interface PatchMarketRelease {
  region: string
  timeZone: string
  effectiveAt?: string | null
  effectiveOn?: string | null
}

export type PatchChangeRow = PublishedChange & {
  patch?: Pick<PatchRelease, "id" | "code" | "title">
  changes?: HeroChangeItem[]
}

const PAGE_SIZE = 50

const readAll = <T>(path: string, params: URLSearchParams, signal: AbortSignal) =>
  wikiGetAll<T>(path, params, signal, { size: PAGE_SIZE })

export const patchReleasesQuery = (scope: WikiCatalogScope) =>
  queryOptions({
    queryKey: updateKeys.releases(scope),
    queryFn: ({ signal }) => readAll<PatchRelease>("/patches", wikiCatalogParameters(scope, false), signal),
    meta: { storedAnswer: "wiki-patches@1" },
    staleTime: 60_000,
    retry: 1,
  })

export const patchChangesQuery = (scope: WikiCatalogScope, release: PatchRelease, domain: ChangeDomain) =>
  queryOptions({
    queryKey: updateKeys.patchChanges(scope, release, domain),
    queryFn: ({ signal }) => {
      const params = wikiCatalogParameters(scope, false)
      params.set("domain", domain)
      params.set("patchVariantId", release.variantId)
      return readAll<PatchChangeRow>(`/patches/${release.id}/changes`, params, signal)
    },
    staleTime: 60_000,
    retry: 1,
  })

export const heroChangesQuery = (scope: WikiCatalogScope, heroId: string) =>
  queryOptions({
    queryKey: updateKeys.heroHistory(scope, heroId),
    queryFn: ({ signal }) =>
      readAll<PatchChangeRow>(
        `/heroes/${encodeURIComponent(heroId)}/changes`,
        wikiCatalogParameters(scope, false),
        signal,
      ),
    staleTime: 60_000,
    retry: 1,
  })

/** Patch dates are calendar days chosen per region; a timestamp only stands in when no day is known. */
export const releaseDateValue = (regionalDate: string | null | undefined, effectiveAt: string | null | undefined) =>
  regionalDate || effectiveAt || null
