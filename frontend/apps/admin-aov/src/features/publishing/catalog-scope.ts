import type { CatalogFilter } from "./catalog-context"

/** Clear the scoped display mode in the same navigation that removes the time scope. */
export function catalogScopePatch(value: CatalogFilter): Record<string, string> {
  return {
    season: value.seasonId,
    patch: value.variantId,
    ...(!value.seasonId && !value.variantId ? { show: "" } : {}),
  }
}
