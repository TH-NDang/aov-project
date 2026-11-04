import { useEffect, useSyncExternalStore } from "react"
import type { CatalogFilter } from "./catalog-context"
import type { PublicationOverview } from "./publication-overview"

const storageKey = "aov.admin.catalog-scope.v1"
const catalogPaths = new Set(["/hero", "/items", "/arcana", "/enchantments", "/spells", "/game-configuration"])

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
  useEffect(() => {
    if (!enabled || (requested.variantId ? !patch : !season)) return
    const next = new URLSearchParams()
    if (patch) {
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

/** Revisiting an admin list tab keeps its filters but follows the shared time selection. */
export function catalogTabTarget(to: string, selection: string) {
  if (!selection) return to
  const url = new URL(to, "http://localhost")
  if (!catalogPaths.has(url.pathname) || url.searchParams.has("item") || url.searchParams.has("hero")) return to
  const saved = new URLSearchParams(selection)
  const ruleset = url.searchParams.get("ruleset")
  if (ruleset && saved.has("ruleset") && ruleset !== saved.get("ruleset")) return to
  for (const key of ["season", "patch"]) {
    const value = saved.get(key)
    if (value) url.searchParams.set(key, value)
    else url.searchParams.delete(key)
  }
  return url.pathname + url.search + url.hash
}
