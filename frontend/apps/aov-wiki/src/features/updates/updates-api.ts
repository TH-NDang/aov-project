import { queryOptions } from "@tanstack/react-query"
import { wikiCatalogParameters, type WikiCatalogScope } from "../../lib/wiki-catalog"
import type { PublishedChange } from "../../lib/published-change-subjects"
import type { HeroChangeItem } from "../../lib/wiki-change-format"
import type { ChangeDomain } from "../../lib/wiki-patch-changes"

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
}

export type PatchChangeRow = PublishedChange & {
  patch?: Pick<PatchRelease, "id" | "code" | "title">
  changes?: HeroChangeItem[]
}

interface Slice<T> {
  items: T[]
  totalElements: number
}

const PAGE_SIZE = 50

async function readAll<T>(path: string, params: URLSearchParams, signal: AbortSignal) {
  const items: T[] = []
  for (let page = 0; ; page++) {
    const query = new URLSearchParams(params)
    query.set("page", String(page))
    query.set("size", String(PAGE_SIZE))
    const response = await fetch(`/api/wiki/v1${path}?${query}`, { credentials: "omit", signal })
    if (!response.ok) throw new Error("Published updates are unavailable.")
    const slice: Slice<T> = await response.json()
    items.push(...slice.items)
    if (!slice.items.length || items.length >= slice.totalElements) return items
  }
}

export const patchReleasesQuery = (scope: WikiCatalogScope) =>
  queryOptions({
    queryKey: ["wiki", "patch-releases", scope.region, scope.locale],
    queryFn: ({ signal }) => readAll<PatchRelease>("/patches", wikiCatalogParameters(scope, false), signal),
    staleTime: 60_000,
    retry: 1,
  })

export const patchChangesQuery = (scope: WikiCatalogScope, release: PatchRelease, domain: ChangeDomain) =>
  queryOptions({
    queryKey: ["wiki", "patch-page-changes", scope.region, scope.locale, release.id, release.variantId, domain],
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
    queryKey: ["wiki", "hero-change-history", scope.region, scope.locale, heroId],
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
