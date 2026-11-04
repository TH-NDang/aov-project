import type { CatalogFilter } from "./catalog-context"
import type { PublicationOverview, Variant } from "./publication-overview"

const scope = (variant?: Variant): CatalogFilter => ({
  seasonId: variant?.seasonId ?? "",
  variantId: variant?.id ?? "",
})

/** Prefer the active VN release, never a newer draft or a future scheduled release. */
export function activeCatalogScope(data: PublicationOverview): CatalogFilter {
  const markets = [...data.markets].sort(
    (a, b) => Number(b.code.toUpperCase() === "VN") - Number(a.code.toUpperCase() === "VN"),
  )
  for (const market of markets) {
    const release = data.releases.find((entry) => entry.id === market.currentReleaseId)
    const variant = data.variants.find((entry) => entry.id === release?.variantId)
    if (variant) return scope(variant)
  }
  return scope()
}

export function currentCatalogScope(data: PublicationOverview): CatalogFilter {
  const active = activeCatalogScope(data)
  if (active.variantId) return active
  const latest = [...data.variants].sort((a, b) => b.rulesetOrdinal - a.rulesetOrdinal)
  return scope(latest.find((entry) => entry.status === "PUBLISHED") ?? latest[0])
}

/** A season spans all its patches. Only an empty scope defaults to the current patch. */
export function resolveCatalogScope(data: PublicationOverview, requested: CatalogFilter): CatalogFilter {
  const explicit = data.variants.find((entry) => entry.id === requested.variantId)
  if (explicit) return scope(explicit)
  if (data.seasons.some((season) => season.id === requested.seasonId))
    return { seasonId: requested.seasonId, variantId: "" }
  return currentCatalogScope(data)
}

export const showAllCatalogEntries = (params: URLSearchParams) => params.get("show") !== "changes"

export function draftInCatalogScope(patchId: string | null, filter: CatalogFilter, variants: readonly Variant[]) {
  if (!patchId) return true
  if (filter.variantId) return patchId === filter.variantId
  return !filter.seasonId || variants.some((variant) => variant.id === patchId && variant.seasonId === filter.seasonId)
}

/** Clear the scoped display mode in the same navigation that removes the time scope. */
export function catalogScopePatch(value: CatalogFilter): Record<string, string> {
  return {
    season: value.seasonId,
    patch: value.variantId,
    ...(!value.seasonId && !value.variantId ? { show: "" } : {}),
  }
}
