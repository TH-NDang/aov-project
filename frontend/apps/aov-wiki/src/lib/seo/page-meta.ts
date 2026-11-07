import { HERO_POSITIONS, HERO_ROLES, localizedHeroOptions } from "../../features/hero/hero-classifications.ts"
import { warehousePath, WAREHOUSE_TABS } from "../wiki-catalog.ts"

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
}

export type WarehouseTab = (typeof WAREHOUSE_TABS)[number]
export type SectionKey = "heroes" | "skins" | WarehouseTab | "updates" | "terms"

const pick = (locale: string, vietnamese: string, english: string) => (locale.startsWith("en") ? english : vietnamese)

const titled = (heading: string) => `${heading} | ${SITE_NAME}`

export const DEFAULT_IMAGE: PageImage = {
  url: "/images/mole-logo-v4.png",
  width: 1254,
  height: 1254,
  type: "image/png",
  alt: SITE_NAME,
}

export const SECTIONS: Record<SectionKey, { path: string; name: [string, string]; description: [string, string] }> = {
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
      "Phép bổ trợ Liên Quân Mobile: tác dụng, thời gian hồi chiêu và cấp mở khóa.",
      "Arena of Valor talents: effects, cooldowns and unlock levels.",
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

/** The chosen translation, or the first one when a language has not been written yet. */
export function translationFor<T extends { locale: string }>(translations: readonly T[], locale: string) {
  return (
    translations.find((translation) => translation.locale === locale) ??
    translations.find((translation) => translation.locale === "vi-VN") ??
    translations[0]
  )
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
    title: titled(heading),
    heading,
    description: pick(locale, ...section.description),
    path: section.path,
    locale,
    image: DEFAULT_IMAGE,
  }
}

export function homeMeta(locale: string): PageMeta {
  const heading = pick(locale, `${SITE_NAME} — Khai mở tri thức`, `${SITE_NAME} — Knowledge uncovered`)
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
      "Gửi góp ý, báo sai dữ liệu hoặc đề xuất gỡ ảnh cho đội ngũ biên tập AOV WiKi.",
      "Send feedback, report wrong data or ask for an image to be removed by the AOV WiKi editors.",
    ),
    path: "/contact",
    locale,
    image: DEFAULT_IMAGE,
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
    description: pick(locale, "Không tìm thấy nội dung này trên AOV WiKi.", "This page was not found on AOV WiKi."),
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
  const heading = hero.title ? `${hero.name} — ${hero.title}` : hero.name
  const roles = heroRoleLabels(hero.roles, locale)
  const identity = pick(
    locale,
    `${heading}: tướng${roles.length ? ` ${roles.join(", ")}` : ""} trong Liên Quân Mobile.`,
    `${heading}: ${roles.length ? `${roles.join(", ")} ` : ""}hero in Arena of Valor.`,
  )
  const details =
    plainText(hero.summary) ||
    pick(
      locale,
      `Kỹ năng, chỉ số, trang phục và lịch sử thay đổi của ${hero.name}.`,
      `Abilities, stats, skins and change history of ${hero.name}.`,
    )
  return {
    title: titled(heading),
    heading,
    description: clampDescription(`${identity} ${details}`),
    path: `/hero/${encodeURIComponent(hero.code)}`,
    locale,
    type: "article",
    image: pageImage(hero.media?.SPLASH ?? hero.media?.PORTRAIT ?? hero.media?.HEAD, hero.name) ?? DEFAULT_IMAGE,
  }
}

export function warehouseEntryMeta(tab: WarehouseTab, entry: WarehouseEntryLike, locale: string): PageMeta {
  const text = translationFor(entry.content.translations, locale)
  const name = text?.name ?? entry.code
  const section = pick(locale, ...SECTIONS[tab].name)
  const heading = `${name} — ${section}`
  const icon = entry.content.iconAssetId ? entry.media?.[entry.content.iconAssetId] : undefined
  const summary = plainText(text?.summary)
  const details = plainText(text?.description)
  const body = [summary, details].filter(Boolean).join(". ")
  return {
    title: titled(heading),
    heading,
    description: clampDescription(
      `${name}: ${section} ${pick(locale, "trong Liên Quân Mobile", "in Arena of Valor")}.${body ? ` ${body}` : ""}`,
    ),
    path: warehousePath(tab, entry.code),
    locale,
    type: "article",
    image: pageImage(icon, name) ?? DEFAULT_IMAGE,
  }
}

export function termMeta(term: { id: string; name: string; description?: string | null }, locale: string): PageMeta {
  const section = pick(locale, ...SECTIONS.terms.name)
  const heading = `${term.name} — ${section}`
  const details = plainText(term.description)
  return {
    title: titled(heading),
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
    path: `/terms/${encodeURIComponent(term.id)}`,
    locale,
    type: "article",
    image: DEFAULT_IMAGE,
  }
}

export function patchMeta(patch: PatchLike, locale: string): PageMeta {
  const heading = plainText(patch.title) || patch.code
  const details = plainText(patch.summary) || plainText(patch.description)
  return {
    title: titled(heading),
    heading,
    description: clampDescription(
      details ||
        pick(
          locale,
          `Ghi chú cập nhật ${patch.code} của Liên Quân Mobile: tướng, trang bị, phù hiệu, bảng ngọc và phụ trợ đã thay đổi. ${heading}.`,
          `Arena of Valor patch notes ${patch.code}: changed heroes, equipment, enchantments, arcana and talents. ${heading}.`,
        ),
    ),
    path: `/updates/${encodeURIComponent(patch.code)}`,
    locale,
    type: "article",
    image: DEFAULT_IMAGE,
  }
}
