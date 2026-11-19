import { useQuery } from "@tanstack/react-query"
import { WikiSectionTiles } from "../../components/wiki-section-tiles"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import type { WikiSectionKey } from "../../lib/wiki-sections"
import { heroCatalogQuery } from "../../lib/hero-api"
import { sectionCountsQuery } from "./home-api"

/** What a tile says under its name when it has no count of its own. */
const HINTS: Partial<Record<WikiSectionKey, [string, string]>> = {
  modes: ["Luật và cẩm nang", "Rules and guides"],
  updates: ["Theo từng bản", "Version by version"],
  terms: ["Từ trong game", "Game words"],
}
const UNITS: Partial<Record<WikiSectionKey, [string, string]>> = {
  heroes: ["tướng", "heroes"],
  skins: ["trang phục", "skins"],
  items: ["món", "items"],
  enchantments: ["phù hiệu", "enchantments"],
  arcana: ["viên ngọc", "arcana"],
  spells: ["phép", "talents"],
}

/** Every section of the Wiki, each tile saying how much it holds. */
export function HomeSections() {
  const scope = useWikiContext()
  const { locale } = scope
  const heroes = useQuery(heroCatalogQuery(scope))
  const counts = useQuery(sectionCountsQuery(scope))
  const countOf = (key: WikiSectionKey) =>
    key === "heroes" ? heroes.data?.items.length : counts.data?.[key as keyof typeof counts.data]

  return (
    <WikiSectionTiles
      label={wikiText(locale, "Các mục của Wiki", "Wiki sections")}
      note={(key) => {
        const count = countOf(key)
        const unit = UNITS[key]
        const hint = HINTS[key]
        if (count != null && unit) return `${count.toLocaleString(locale)} ${wikiText(locale, ...unit)}`
        return hint && wikiText(locale, ...hint)
      }}
    />
  )
}
