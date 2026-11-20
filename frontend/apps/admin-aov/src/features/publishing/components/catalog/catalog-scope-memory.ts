import { useEffect, useSyncExternalStore } from "react"
import type { PublicationOverview } from "../../api/publication-overview"
import { type CatalogFilter } from "@/lib/catalog-scope"

const storageKey = "aov.admin.catalog-scope.v1"

function read() {
  try {
    return window.localStorage.getItem(storageKey) ?? ""
  } catch {
    return ""
  }
}

function subscribe(listener: () => void) {
  window.addEventListener(storageKey, listener)
  window.addEventListener("storage", listener)
  return () => {
    window.removeEventListener(storageKey, listener)
    window.removeEventListener("storage", listener)
  }
}

export function useSavedCatalogScope() {
  return useSyncExternalStore(subscribe, read, () => "")
}

export function useCatalogScopePreference(
  data: PublicationOverview | undefined,
  requested: CatalogFilter,
  enabled = true,
) {
  const saved = new URLSearchParams(useSavedCatalogScope())
  const patch = data?.variants.find((v) => v.id === requested.variantId)
  const season = data?.seasons.find((s) => s.id === requested.seasonId)
  // Only the saved fields are read, so a new copy of the same overview saves nothing.
  useEffect(() => {
    if (!enabled || (requested.variantId ? !patch?.id : !season?.id)) return
    const next = new URLSearchParams()
    if (patch?.id) {
      next.set("patch", patch.id)
      next.set("ruleset", patch.rulesetId)
    }
    const seasonId = patch?.seasonId ?? season?.id
    if (seasonId) next.set("season", seasonId)
    try {
      if (next.toString() !== read()) {
        window.localStorage.setItem(storageKey, next.toString())
        window.dispatchEvent(new window.Event(storageKey))
      }
    } catch {
      // Explicit URLs still work when the browser disables storage.
    }
  }, [enabled, requested.variantId, patch?.id, patch?.rulesetId, patch?.seasonId, season?.id])
  if (!enabled || requested.variantId || requested.seasonId || !data) return requested
  if (saved.has("patch")) {
    const variant = data.variants.find((v) => v.id === saved.get("patch"))
    return variant ? { seasonId: variant.seasonId ?? "", variantId: variant.id } : requested
  }
  const savedSeason = data.seasons.find((s) => s.id === saved.get("season"))
  return savedSeason ? { seasonId: savedSeason.id, variantId: "" } : requested
}
