import type { SkinEntry } from "./skin-api"

export type HeroSort = "most" | "fewest" | "name"
export type SkinSort = "tier" | "name"

const tiers = ["a", "s", "s-plus", "ss", "ss-plus", "sss", "sss-plus"]

function tier(skin: SkinEntry) {
  const code = skin.rarityCode ?? skin.badge?.code ?? ""
  const rank = /^(?:bac-)?(sss|ss|s|a)(-plus)?(?:-|$)/.exec(code)
  return rank ? tiers.indexOf(rank[1] + (rank[2] ?? "")) : -1
}

export function groupSkins(skins: SkinEntry[], heroSort: HeroSort, skinSort: SkinSort, locale: string) {
  const byHero = new Map<string, SkinEntry[]>()
  for (const skin of skins) {
    const group = byHero.get(skin.heroId)
    if (group) group.push(skin)
    else byHero.set(skin.heroId, [skin])
  }
  const { compare } = new Intl.Collator(locale, { numeric: true, sensitivity: "base" })
  const groups = [...byHero.values()]
  for (const group of groups) {
    group.sort(
      (a, b) =>
        (skinSort === "tier" ? tier(b) - tier(a) : 0) || compare(a.name, b.name) || compare(a.skinKey, b.skinKey),
    )
  }
  return groups.sort((a, b) => {
    const count = heroSort === "most" ? b.length - a.length : heroSort === "fewest" ? a.length - b.length : 0
    return count || compare(a[0].heroName, b[0].heroName) || compare(a[0].heroCode, b[0].heroCode)
  })
}
