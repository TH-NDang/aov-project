import { useSearchParams } from "react-router"
import type { HeroSort, SkinSort } from "../../lib/skin-groups"

export type FilterKey = "q" | "hero" | "rarity" | "heroSort" | "skinSort"

/** The search, the filters and the two orders of the collection, kept in the address so a view can be shared. */
export function useSkinFilters() {
  const [parameters, setParameters] = useSearchParams()
  const search = (parameters.get("q") || "").slice(0, 120)
  const hero = parameters.get("hero") || ""
  const rarity = parameters.get("rarity") || ""
  const heroOrder = parameters.get("heroSort")
  const heroSort: HeroSort = heroOrder === "fewest" || heroOrder === "name" ? heroOrder : "most"
  const skinSort: SkinSort = parameters.get("skinSort") === "name" ? "name" : "tier"
  const activeFilters = (hero ? 1 : 0) + (rarity ? 1 : 0)

  function update(key: FilterKey, value: string) {
    const next = new URLSearchParams(parameters)
    if (value) next.set(key, value)
    else next.delete(key)
    setParameters(next, { replace: key === "q" })
  }

  function clear(keys: FilterKey[] = ["q", "hero", "rarity"]) {
    const next = new URLSearchParams(parameters)
    for (const key of keys) next.delete(key)
    setParameters(next)
  }

  return {
    search,
    hero,
    rarity,
    heroSort,
    skinSort,
    /** How many of the hero and tier filters are set; the search is counted apart. */
    activeFilters,
    hasFilters: !!search || activeFilters > 0,
    update,
    clear,
  }
}

export type SkinFilters = ReturnType<typeof useSkinFilters>
