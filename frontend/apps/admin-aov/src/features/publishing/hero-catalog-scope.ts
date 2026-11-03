import type { CatalogFilter } from "./catalog-context"
import type { PublicationOverview, Variant } from "./publication-overview"

const scope = (variant?: Variant): CatalogFilter => ({
  seasonId: variant?.seasonId ?? "",
  variantId: variant?.id ?? "",
})

/** Prefer the active VN release, never a newer draft or a future scheduled release. */
export function currentHeroCatalogScope(data: PublicationOverview): CatalogFilter {
  const markets = [...data.markets].sort((a, b) => Number(b.code === "VN") - Number(a.code === "VN"))
  for (const market of markets) {
    const release = data.releases.find((entry) => entry.id === market.currentReleaseId)
    const variant = data.variants.find((entry) => entry.id === release?.variantId)
    if (variant) return scope(variant)
  }
  const latest = [...data.variants].sort((a, b) => b.rulesetOrdinal - a.rulesetOrdinal)
  return scope(latest.find((entry) => entry.status === "PUBLISHED") ?? latest[0])
}

/** A season click selects its active patch, or its last recorded patch when inactive. */
export function resolveHeroCatalogScope(data: PublicationOverview, requested: CatalogFilter): CatalogFilter {
  const explicit = data.variants.find((entry) => entry.id === requested.variantId)
  if (explicit) return scope(explicit)
  const current = currentHeroCatalogScope(data)
  if (!requested.seasonId || requested.seasonId === current.seasonId) return current
  return scope(
    [...data.variants]
      .filter((entry) => entry.seasonId === requested.seasonId)
      .sort((a, b) => b.rulesetOrdinal - a.rulesetOrdinal)[0],
  )
}

export const showAllHeroes = (params: URLSearchParams) => params.get("show") !== "changes"
