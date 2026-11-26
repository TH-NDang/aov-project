import { useQuery } from "@tanstack/react-query"
import { referenceTranslation, type EntityReference } from "@aov/ui/lib/entity-rich-text"
import type { WikiIconName } from "../../components/wiki-icon"
import { useWikiContext, useWikiText } from "../../context/wiki-context"
import { dailySpread } from "../../lib/daily-spread"
import { heroCatalogQuery } from "../../lib/hero-api"
import { HERO_ROLES, localizedHeroOptions } from "../../lib/hero-classifications"
import { SECTION_NAMES, wikiSections, type WikiSectionKey } from "../../lib/wiki-sections"
import { warehouseCatalogQuery, warehouseGroupsQuery } from "../../lib/warehouse-api"
import { warehouseImage } from "../../lib/warehouse-types"
import { wikiReferencesQuery } from "../../lib/wiki-references"
import { HOME_BANNERS } from "../../lib/home-banners"
import { sectionCountsQuery } from "../../lib/section-counts"
import { skinSampleQuery } from "../../lib/skin-api"
import { modesOpenQuery } from "./home-api"
import { kindTally, useChangedHeroes } from "../../lib/use-changed-heroes"

/** How a section's pictures are drawn: photos fill a frame, icons sit whole on a plain ground. */
export type PictureShape = "photo" | "icon" | "face"

/** One picture of a section; a changed hero also carries the kind of its change. */
export interface SectionPicture {
  url: string
  kind?: string
}

/** One section of the Wiki as the home page shows it. */
export interface HomeSection {
  key: WikiSectionKey
  icon: WikiIconName
  to: string
  name: string
  count?: number
  shape: PictureShape
  /** Real pictures of the section, picked for the day; empty while they load or for a section without pictures. */
  pictures: SectionPicture[]
  /** For the glossary, a few of its terms stand in for pictures, each with the term it names for its icon. */
  words: { name: string; term: EntityReference }[]
  /** For updates, how many heroes the version in force changed in each way. */
  tally: [kind: string, count: number][]
}

/** Days since the epoch in the reader's zone, so the pictures change at their midnight. */
function dayNumber() {
  const now = new Date()
  return Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / 86_400_000)
}

/**
 * Every section of the Wiki with its name, its count and real pictures from its catalog: hero portraits, skin cards,
 * finished (tier 3) equipment, the emblem of every enchantment branch, a tier-3 arcana of each colour, talent icons,
 * the faces of the heroes the version in force changed with the kind of their change, and a few glossary terms.
 */
export function useHomeSections(): HomeSection[] {
  const scope = useWikiContext()
  const { href, locale } = scope
  const t = useWikiText()
  const heroes = useQuery(heroCatalogQuery(scope))
  const counts = useQuery(sectionCountsQuery(scope))
  const modes = useQuery(modesOpenQuery())
  const skins = useQuery(skinSampleQuery(scope))
  const references = useQuery(wikiReferencesQuery(scope))
  const items = useQuery(warehouseCatalogQuery("items", scope))
  const arcana = useQuery(warehouseCatalogQuery("arcana", scope))
  const branches = useQuery(warehouseGroupsQuery("enchantments", locale))
  const changed = useChangedHeroes()
  const day = dayNumber()
  const pick = <T>(pool: T[], count: number) => dailySpread(pool.length, day, count).map((index) => pool[index]!)

  const entities = references.data?.entities ?? []
  const asPictures = (urls: string[]) => urls.map((url) => ({ url }))
  const heroList = heroes.data?.items ?? []
  // The game's tall skin cards keep the face in their upper middle, so a narrow slice never cuts it off.
  const skinCards = (skins.data ?? []).flatMap((skin) => skin.portrait?.currentVersion?.url ?? [])
  const finishedItems = (items.data ?? []).flatMap((item) =>
    item.kind === "items" && item.content.tier === 3 ? (warehouseImage(item) ?? []) : [],
  )
  const topArcana = (arcana.data ?? []).filter((gem) => gem.kind === "arcana" && gem.content.tier === 3)
  const arcanaByColour = (["RED", "PURPLE", "GREEN"] as const).flatMap((colour) =>
    pick(
      topArcana.flatMap((gem) =>
        gem.kind === "arcana" && gem.content.color === colour ? (warehouseImage(gem) ?? []) : [],
      ),
      1,
    ),
  )

  const pictures: Partial<Record<WikiSectionKey, SectionPicture[]>> = {
    heroes: asPictures(
      pick(
        heroList.flatMap((hero) => hero.portrait?.currentVersion?.url ?? []),
        8,
      ),
    ),
    skins: asPictures(skinCards.length >= 3 ? pick(skinCards, 6) : HOME_BANNERS.map((banner) => banner.image)),
    items: asPictures(pick(finishedItems, 8)),
    enchantments: asPictures(
      [...(branches.data ?? [])]
        .sort((first, second) => first.displayOrder - second.displayOrder)
        .flatMap((branch) => branch.icon?.currentVersion?.url ?? []),
    ),
    arcana: asPictures(arcanaByColour),
    spells: asPictures(
      pick(
        entities.flatMap((entity) => (entity.kind === "spell" && entity.icon ? [entity.icon] : [])),
        8,
      ),
    ),
    updates: changed.heroes
      .flatMap((hero) => {
        const url = hero.shown?.head?.currentVersion?.url
        return url ? [{ url, kind: hero.kind }] : []
      })
      .slice(0, 8),
  }
  const words = pick(
    entities.filter((entity) => entity.kind === "term"),
    6,
  ).flatMap((term) => {
    const name = referenceTranslation(term, locale)?.name
    return name ? [{ name, term }] : []
  })

  const countOf = (key: WikiSectionKey) =>
    key === "heroes" ? (heroes.data ? heroList.length : undefined) : counts.data?.[key as keyof typeof counts.data]

  return wikiSections
    .filter((section) => section.key !== "modes" || modes.data)
    .map((section) => ({
      key: section.key,
      icon: section.icon,
      to: href(section.path),
      name: section.key === "updates" ? t(...SECTION_NAMES.updatesShort!) : t(...SECTION_NAMES[section.key]!),
      count: countOf(section.key),
      shape:
        section.key === "heroes" || section.key === "skins" ? "photo" : section.key === "updates" ? "face" : "icon",
      pictures: pictures[section.key] ?? [],
      words: section.key === "terms" ? words : [],
      tally: section.key === "updates" ? [...kindTally(changed.heroes)] : [],
    }))
}

/** The six roles with how many heroes each holds, as links into the hero list. */
export function useHomeRoles() {
  const scope = useWikiContext()
  const { href, locale } = scope
  const heroes = useQuery(heroCatalogQuery(scope))
  const list = heroes.data?.items ?? []
  return localizedHeroOptions(HERO_ROLES, locale).map((role) => ({
    ...role,
    to: href(`/hero?role=${role.value}`),
    count: list.filter((hero) => hero.roles.includes(role.value)).length || undefined,
  }))
}
