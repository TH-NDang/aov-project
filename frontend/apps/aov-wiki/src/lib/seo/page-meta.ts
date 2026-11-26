import { localeText } from "@aov/ui/lib/locale-text"
import { HERO_POSITIONS, HERO_ROLES, localizedHeroOptions } from "../hero-classifications.ts"
import { warehousePath, WAREHOUSE_TABS } from "../wiki-catalog.ts"
import { warehouseText } from "@aov/ui/lib/warehouse-content"

export const SITE_NAME = "AOV WiKi"
const DESCRIPTION_LENGTH = 160

export interface PageImage {
  url: string
  width?: number
  height?: number
  type?: string
  alt?: string
}

export interface PageMeta {
  /** The document title, with the site name. */
  title: string
  /** The name shown on a preview card, which adds the site name by itself. */
  heading: string
  description: string
  /** The root path of the canonical URL: never a query string, because locale and scope only change the view. */
  path: string
  locale: string
  type?: "website" | "article"
  image?: PageImage
  noindex?: boolean
  /** The way down from the home page to this one, this page last; it becomes the page's BreadcrumbList. */
  breadcrumbs?: readonly Crumb[]
  /** When an article went live, as a date or timestamp: patch notes are read by their date. */
  published?: string | null
}

export interface Crumb {
  name: string
  path: string
}

export interface MediaVersionLike {
  url: string
  width?: number
  height?: number
  mimeType?: string
}

export interface MediaLike {
  currentVersion?: MediaVersionLike | null
}

export interface HeroMetaSource {
  code: string
  name: string
  roles?: readonly string[]
  title?: string | null
  summary?: string | null
  media?: Partial<Record<"HEAD" | "PORTRAIT" | "SPLASH", MediaLike | undefined>> | null
  /** The form being read of a hero that holds forms (ADR-024); the default form keeps the hero's own address. */
  form?: { key: string; label: string; isDefault: boolean } | null
  /** Whether a build is published for the hero; only then do the title and description promise one. */
  hasBuild?: boolean
}

export interface TranslationLike {
  locale: string
  name: string
  summary?: string | null
  description?: string | null
}

export interface WarehouseEntryLike {
  code: string
  content: { iconAssetId: string | null; translations: readonly TranslationLike[] }
  media?: Record<string, MediaLike | undefined> | null
}

export interface PatchLike {
  code: string
  title?: string | null
  summary?: string | null
  description?: string | null
  effectiveAt?: string | null
}

export type WarehouseTab = (typeof WAREHOUSE_TABS)[number]
export type SectionKey = "heroes" | "skins" | WarehouseTab | "updates" | "terms" | "modes"

const pick = (locale: string, vietnamese: string, english: string) => localeText(locale)(vietnamese, english)

const titled = (heading: string) => `${heading} | ${SITE_NAME}`

/** Readers search with the game's name, so every title carries it once. */
const GAME = { short: ["Liên Quân", "Arena of Valor"], full: ["Liên Quân Mobile", "Arena of Valor"] } as const
const namesGame = (text: string) => /li[eê]n qu[aâ]n|arena of valor|\baov\b/i.test(text.replace(SITE_NAME, ""))

/** An entry named with its section and the game, such as "Cloak — Arena of Valor equipment". */
const ofGame = (name: string, section: string, locale: string) =>
  pick(locale, `${name} — ${section} ${GAME.short[0]}`, `${name} — ${GAME.short[1]} ${section.toLowerCase()}`)

const homeCrumb = (locale: string): Crumb => ({ name: pick(locale, "Trang chủ", "Home"), path: "/" })

const sectionCrumb = (key: SectionKey, locale: string): Crumb => ({
  name: pick(locale, ...SECTIONS[key].name),
  path: SECTIONS[key].path,
})

const crumbs = (locale: string, ...rest: Crumb[]) => [homeCrumb(locale), ...rest]

/** The wide card for pages without art of their own: link previews crop to about 1.91:1. */
export const DEFAULT_IMAGE: PageImage = {
  url: "/images/og-default.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: `${SITE_NAME} — Sổ tay Liên Quân Mobile`,
}

/** The square mark, for structured data that asks for a logo. */
export const LOGO_IMAGE = "/images/mole-logo-v4.png"

export const SECTIONS: Record<SectionKey, { path: string; name: [string, string]; description: [string, string] }> = {
  modes: {
    path: "/modes",
    name: ["Chế độ chơi", "Game modes"],
    description: [
      "Các chế độ chơi Liên Quân Mobile: thời lượng, tình trạng mở, luật chơi và cẩm nang Cờ Liên quân.",
      "Arena of Valor game modes: match length, availability, rules and the auto-chess guide.",
    ],
  },
  heroes: {
    path: "/hero",
    name: ["Tướng", "Heroes"],
    description: [
      "Danh sách tướng Liên Quân Mobile: vai trò, vị trí, kỹ năng, chỉ số và trang phục của từng tướng.",
      "Every Arena of Valor hero: roles, positions, abilities, stats and skins.",
    ],
  },
  skins: {
    path: "/skins",
    name: ["Trang phục", "Skins"],
    description: [
      "Bộ sưu tập trang phục Liên Quân Mobile, xem theo tướng và theo độ hiếm.",
      "The Arena of Valor skin collection, browsable by hero and rarity.",
    ],
  },
  items: {
    path: warehousePath("items"),
    name: ["Trang bị", "Equipment"],
    description: [
      "Toàn bộ trang bị Liên Quân Mobile: chỉ số, giá vàng, công thức ghép và nội tại.",
      "All Arena of Valor equipment: stats, gold prices, recipes and passives.",
    ],
  },
  enchantments: {
    path: warehousePath("enchantments"),
    name: ["Phù hiệu", "Enchantments"],
    description: [
      "Phù hiệu Liên Quân Mobile theo từng nhánh, cùng hiệu ứng của mỗi phù hiệu.",
      "Arena of Valor enchantments by branch, with the effect of each one.",
    ],
  },
  arcana: {
    path: warehousePath("arcana"),
    name: ["Bảng ngọc", "Arcana"],
    description: [
      "Bảng ngọc Liên Quân Mobile theo màu và cấp, cùng chỉ số mà mỗi viên ngọc mang lại.",
      "Arena of Valor arcana by color and tier, with the stats each one grants.",
    ],
  },
  spells: {
    path: warehousePath("spells"),
    name: ["Phụ trợ", "Talents"],
    description: [
      "Phép bổ trợ Liên Quân Mobile: tác dụng và thời gian hồi chiêu.",
      "Arena of Valor talents: effects and cooldowns.",
    ],
  },
  updates: {
    path: "/updates",
    name: ["Ghi chú cập nhật", "Patch notes"],
    description: [
      "Những gì đã thay đổi trong từng phiên bản Liên Quân Mobile, đối chiếu với nguồn công bố.",
      "What changed in each Arena of Valor version, checked against the published source.",
    ],
  },
  terms: {
    path: "/terms",
    name: ["Thuật ngữ", "Glossary"],
    description: [
      "Giải thích các từ dùng trong mô tả kỹ năng, trang bị và ghi chú cập nhật của Liên Quân Mobile.",
      "Explains the words used in Arena of Valor ability, item and patch descriptions.",
    ],
  },
}

/** Game text carries display markup such as <color=#fff>; worked examples only make sense as tables on the page. */
export function plainText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/<example>[\s\S]*?<\/example>/gi, " ")
    .replace(/<\/?[a-z][^<>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?)])/g, "$1")
    .trim()
}

/** Search engines cut longer descriptions mid-sentence, so end on a whole word. */
export function clampDescription(value: string, limit = DESCRIPTION_LENGTH) {
  if (value.length <= limit) return value
  const cut = value.slice(0, limit - 1)
  const lastSpace = cut.lastIndexOf(" ")
  return `${(lastSpace > limit / 2 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.–—-]+$/u, "")}…`
}

const pageImage = (media: MediaLike | null | undefined, alt: string): PageImage | undefined => {
  const version = media?.currentVersion
  return version
    ? { url: version.url, width: version.width, height: version.height, type: version.mimeType, alt }
    : undefined
}

export function sectionMeta(key: SectionKey, locale: string): PageMeta {
  const section = SECTIONS[key]
  const heading = pick(locale, ...section.name)
  return {
    title: titled(pick(locale, `${heading} ${GAME.full[0]}`, `${GAME.full[1]} ${heading.toLowerCase()}`)),
    heading,
    description: pick(locale, ...section.description),
    path: section.path,
    locale,
    image: DEFAULT_IMAGE,
    breadcrumbs: crumbs(locale, sectionCrumb(key, locale)),
  }
}

export function homeMeta(locale: string): PageMeta {
  const heading = pick(locale, `${SITE_NAME} — Sổ tay Liên Quân Mobile`, `${SITE_NAME} — Arena of Valor handbook`)
  return {
    title: heading,
    heading,
    description: pick(
      locale,
      "Sổ tay Liên Quân Mobile: tướng, trang phục, trang bị, phù hiệu, bảng ngọc, phụ trợ và ghi chú cập nhật theo từng phiên bản.",
      "An Arena of Valor handbook: heroes, skins, equipment, enchantments, arcana, talents and patch notes for each version.",
    ),
    path: "/",
    locale,
    image: DEFAULT_IMAGE,
  }
}

export function contactMeta(locale: string): PageMeta {
  const heading = pick(locale, "Liên hệ", "Contact")
  return {
    title: titled(heading),
    heading,
    description: pick(
      locale,
      `Gửi góp ý, báo sai dữ liệu hoặc đề xuất gỡ ảnh cho đội ngũ biên tập ${SITE_NAME}.`,
      `Send feedback, report wrong data or ask for an image to be removed by the ${SITE_NAME} editors.`,
    ),
    path: "/contact",
    locale,
    image: DEFAULT_IMAGE,
    breadcrumbs: crumbs(locale, { name: heading, path: "/contact" }),
  }
}

/** A page that does not exist must not compete in search results with the section it falls back to. */
export function notFoundMeta(locale: string, path: string, section?: SectionKey): PageMeta {
  const heading = section
    ? pick(locale, ...SECTIONS[section].name)
    : pick(locale, "Không tìm thấy trang", "Page not found")
  return {
    title: titled(heading),
    heading,
    description: pick(
      locale,
      `Không tìm thấy nội dung này trên ${SITE_NAME}.`,
      `This page was not found on ${SITE_NAME}.`,
    ),
    path,
    locale,
    image: DEFAULT_IMAGE,
    noindex: true,
  }
}

/** The library pages whose description does not depend on loaded data; pages about one thing describe themselves. */
export function libraryPageMeta(pathname: string, locale: string): PageMeta | null {
  const segments = pathname.split("/").filter(Boolean)
  const [root, tab, entry] = segments
  if (root === "hero" && !tab) return sectionMeta("heroes", locale)
  if (root === "skins") return sectionMeta("skins", locale)
  if (root === "updates" && !tab) return sectionMeta("updates", locale)
  if (root === "terms" && !tab) return sectionMeta("terms", locale)
  if (root === "modes" && !tab) return sectionMeta("modes", locale)
  if (root === "warehouse" && !entry) {
    const section = WAREHOUSE_TABS.find((candidate) => candidate === tab) ?? "items"
    return sectionMeta(section, locale)
  }
  return null
}

export const heroRoleLabels = (roles: readonly string[] | undefined, locale: string) =>
  localizedHeroOptions(HERO_ROLES, locale)
    .filter((role) => roles?.includes(role.value))
    .map((role) => role.label)

export const heroPositionLabels = (positions: readonly string[] | undefined, locale: string) =>
  localizedHeroOptions(HERO_POSITIONS, locale)
    .filter((position) => positions?.includes(position.value))
    .map((position) => position.label)

export function heroMeta(hero: HeroMetaSource, locale: string): PageMeta {
  const form = hero.form && !hero.form.isDefault ? hero.form : undefined
  const named = form ? `${hero.name} (${form.label})` : hero.name
  const heading = hero.title ? `${named} — ${hero.title}` : named
  const contents = hero.hasBuild
    ? pick(locale, "lên đồ, bảng ngọc, kỹ năng", "build, arcana and abilities")
    : pick(locale, "kỹ năng, trang phục", "abilities and skins")
  const roles = heroRoleLabels(hero.roles, locale)
  const identity = pick(
    locale,
    `${heading}: tướng${roles.length ? ` ${roles.join(", ")}` : ""} trong Liên Quân Mobile.`,
    `${heading}: ${roles.length ? `${roles.join(", ")} ` : ""}hero in Arena of Valor.`,
  )
  const details =
    plainText(hero.summary) ||
    (hero.hasBuild
      ? pick(
          locale,
          `Cách lên đồ, bảng ngọc, phù hiệu, kỹ năng và trang phục của ${hero.name}.`,
          `How to build ${hero.name}: items, arcana, enchantments, abilities and skins.`,
        )
      : pick(
          locale,
          `Kỹ năng, chỉ số, trang phục và lịch sử thay đổi của ${hero.name}.`,
          `Abilities, stats, skins and change history of ${hero.name}.`,
        ))
  const path = form
    ? `/hero/${encodeURIComponent(hero.code)}/${encodeURIComponent(form.key)}`
    : `/hero/${encodeURIComponent(hero.code)}`
  return {
    title: titled(pick(locale, `${named} ${GAME.short[0]}: ${contents}`, `${named} — ${GAME.short[1]} ${contents}`)),
    heading,
    description: clampDescription(`${identity} ${details}`),
    path,
    locale,
    type: "article",
    image: pageImage(hero.media?.SPLASH ?? hero.media?.PORTRAIT ?? hero.media?.HEAD, hero.name) ?? DEFAULT_IMAGE,
    breadcrumbs: crumbs(locale, sectionCrumb("heroes", locale), { name: named, path }),
  }
}

export function warehouseEntryMeta(tab: WarehouseTab, entry: WarehouseEntryLike, locale: string): PageMeta {
  const text = warehouseText(entry.content.translations, locale)
  const name = text?.name ?? entry.code
  const section = pick(locale, ...SECTIONS[tab].name)
  const heading = `${name} — ${section}`
  const icon = entry.content.iconAssetId ? entry.media?.[entry.content.iconAssetId] : undefined
  const summary = plainText(text?.summary)
  const details = plainText(text?.description)
  const body = [summary, details].filter(Boolean).join(". ")
  const path = warehousePath(tab, entry.code)
  return {
    title: titled(ofGame(name, section, locale)),
    heading,
    description: clampDescription(
      `${name}: ${section} ${pick(locale, "trong Liên Quân Mobile", "in Arena of Valor")}.${body ? ` ${body}` : ""}`,
    ),
    path,
    locale,
    type: "article",
    image: pageImage(icon, name) ?? DEFAULT_IMAGE,
    breadcrumbs: crumbs(locale, sectionCrumb(tab, locale), { name, path }),
  }
}

export function termMeta(term: { id: string; name: string; description?: string | null }, locale: string): PageMeta {
  const section = pick(locale, ...SECTIONS.terms.name)
  const heading = `${term.name} — ${section}`
  const details = plainText(term.description)
  const path = `/terms/${encodeURIComponent(term.id)}`
  return {
    title: titled(ofGame(term.name, section, locale)),
    heading,
    description: clampDescription(
      details
        ? `${term.name}: ${details}`
        : pick(
            locale,
            `${term.name}: thuật ngữ trong Liên Quân Mobile.`,
            `${term.name}: a term used in Arena of Valor.`,
          ),
    ),
    path,
    locale,
    type: "article",
    image: DEFAULT_IMAGE,
    breadcrumbs: crumbs(locale, sectionCrumb("terms", locale), { name: term.name, path }),
  }
}

/** What the mode page needs for its head; the art is the cleaned lobby image. */
export interface ModeMetaSource {
  code: string
  name: string
  summary?: string | null
  hasGuide?: boolean
  art?: { url: string; width?: number; height?: number } | null
}

export function modeMeta(mode: ModeMetaSource, locale: string): PageMeta {
  const section = pick(locale, ...SECTIONS.modes.name)
  const heading = `${mode.name} — ${section}`
  const details = plainText(mode.summary)
  const path = `/modes/${encodeURIComponent(mode.code)}`
  return {
    title: titled(ofGame(mode.name, section, locale)),
    heading,
    description: clampDescription(
      details ||
        pick(
          locale,
          `${mode.name}: chế độ chơi trong Liên Quân Mobile — thời lượng, tình trạng mở và luật chơi${mode.hasGuide ? ", cùng cẩm nang chi tiết" : ""}.`,
          `${mode.name}: an Arena of Valor game mode — match length, availability and rules${mode.hasGuide ? ", with a detailed guide" : ""}.`,
        ),
    ),
    path,
    locale,
    type: "article",
    image: mode.art
      ? { url: mode.art.url, width: mode.art.width, height: mode.art.height, alt: mode.name }
      : DEFAULT_IMAGE,
    breadcrumbs: crumbs(locale, sectionCrumb("modes", locale), { name: mode.name, path }),
  }
}

export function patchMeta(patch: PatchLike, locale: string): PageMeta {
  const heading = plainText(patch.title) || patch.code
  const details = plainText(patch.summary) || plainText(patch.description)
  const path = `/updates/${encodeURIComponent(patch.code)}`
  return {
    title: titled(namesGame(heading) ? heading : `${heading} — ${pick(locale, ...GAME.full)}`),
    heading,
    description: clampDescription(
      details ||
        pick(
          locale,
          `Ghi chú cập nhật ${patch.code} của Liên Quân Mobile: tướng, trang bị, phù hiệu, bảng ngọc và phụ trợ đã thay đổi. ${heading}.`,
          `Arena of Valor patch notes ${patch.code}: changed heroes, equipment, enchantments, arcana and talents. ${heading}.`,
        ),
    ),
    path,
    locale,
    type: "article",
    image: DEFAULT_IMAGE,
    breadcrumbs: crumbs(locale, sectionCrumb("updates", locale), { name: heading, path }),
    published: patch.effectiveAt,
  }
}
