import { useMemo } from "react"
import type { Hero, Skin } from "@/lib/api/types"
import { buildOwnerIndex } from "@/lib/domain/portraits"
import { useHeroes, useItemIssues, usePortraits } from "@/lib/queries"

export interface HeroIndex {
  heroes: Hero[]
  heroById: Map<string, Hero>
  heroByName: Map<string, Hero>
  skinById: Map<string, { hero: Hero; skin: Skin }>
  owners: ReturnType<typeof buildOwnerIndex>
  /** Number of skins using each badge id. */
  badgeUsage: Map<string, number>
}

/** Lookup tables derived from the hero list; recomputed only when the list changes. */
export function useHeroIndex() {
  const query = useHeroes()
  const index = useMemo<HeroIndex | undefined>(() => {
    const heroes = query.data
    if (!heroes) return undefined
    const skinById = new Map<string, { hero: Hero; skin: Skin }>()
    const badgeUsage = new Map<string, number>()
    for (const hero of heroes) {
      for (const skin of hero.skins) {
        skinById.set(skin.id, { hero, skin })
        if (skin.badgeId) badgeUsage.set(skin.badgeId, (badgeUsage.get(skin.badgeId) ?? 0) + 1)
      }
    }
    return {
      heroes,
      heroById: new Map(heroes.map((hero) => [hero.id, hero])),
      heroByName: new Map(heroes.map((hero) => [hero.name, hero])),
      skinById,
      owners: buildOwnerIndex(heroes),
      badgeUsage,
    }
  }, [query.data])
  return { ...query, index }
}

/** Counts surfaced as badges in the navigation and on the dashboard. */
export function useAttentionCounts() {
  const { index } = useHeroIndex()
  const portraits = usePortraits()
  const issues = useItemIssues()
  return useMemo(
    () => ({
      unmatchedPortraits:
        index && portraits.data ? portraits.data.filter((row) => !index.owners.has(row.file)).length : undefined,
      itemIssues: issues.data?.length,
    }),
    [index, portraits.data, issues.data],
  )
}
