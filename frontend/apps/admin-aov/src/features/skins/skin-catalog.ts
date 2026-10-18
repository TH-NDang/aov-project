import type { HeroRow, Revision, Skin, Preview, PageSlice } from "../publishing/types"

export interface CatalogSkin {
  id: string
  heroId: string
  heroCode: string
  heroName: string
  revision: Revision
  skin: Skin
}
export function selectSkinRevision(hero: HeroRow, ruleset: string, state: string) {
  return hero.revisions
    .filter(
      (revision) =>
        revision.rulesetId === ruleset &&
        revision.state !== "DISCARDED" &&
        (state === "latest" || revision.state === state),
    )
    .sort((a, b) => b.revisionNo - a.revisionNo)[0]
}
export async function loadSkinPage(
  api: {
    heroes: (page: number) => Promise<PageSlice<HeroRow>>
    read: (heroId: string, revisionId: string) => Promise<Preview>
  },
  page: number,
  ruleset: string,
  state: string,
  locale: string,
) {
  const heroes = await api.heroes(page)
  const rows: CatalogSkin[] = []
  // Limit parallel reads while reusing the existing revision APIs.
  for (let start = 0; start < heroes.items.length; start += 4) {
    const groups = await Promise.all(
      heroes.items.slice(start, start + 4).map(async (hero) => {
        const revision = selectSkinRevision(hero, ruleset, state)
        if (!revision) return []
        const preview = await api.read(hero.id, revision.id)
        const names = preview.content.PROFILE?.translations ?? []
        const heroName = (names.find((translation) => translation.locale === locale) ?? names[0])?.name ?? hero.code
        return (preview.content.SKINS?.skins ?? []).map((skin) => ({
          id: `${hero.id}/${revision.id}/${skin.skinKey}`,
          heroId: hero.id,
          heroCode: hero.code,
          heroName,
          revision,
          skin,
        }))
      }),
    )
    rows.push(...groups.flat())
  }
  return { ...heroes, items: rows }
}
