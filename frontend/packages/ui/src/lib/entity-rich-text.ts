import { isParagraphStyle, readExampleTable, type ParagraphStyle } from "./rich-text-blocks"
import { foldSearchText } from "@aov/ui/lib/search-text"
import { referenceKinds, type EntityKind } from "@aov/ui/lib/reference-kinds"
import {
  addressPattern,
  nameRule,
  nameStrength,
  plainPunctuation,
  trimAddress,
  type NameForm,
  type NameStrength,
  type RecognizableName,
} from "./reference-names"

export const entityKindLabels = {
  hero: "Tướng",
  skill: "Kỹ năng",
  item: "Trang bị",
  enchantment: "Phù hiệu",
  arcana: "Bảng ngọc",
  spell: "Phụ trợ",
  mode: "Chế độ chơi",
  circuit: "Hệ thống giải",
  organization: "Tổ chức",
  competition: "Giải đấu",
  team: "Đội tuyển",
  player: "Tuyển thủ",
  person: "Nhân sự",
  country: "Quốc gia / khu vực",
  term: "Thuật ngữ",
} as const satisfies Record<EntityKind, string>
export type { EntityKind }
const entityKindEnglish: Record<EntityKind, string> = {
  hero: "Hero",
  skill: "Ability",
  item: "Item",
  enchantment: "Enchantment",
  arcana: "Arcana",
  spell: "Talent",
  mode: "Game mode",
  circuit: "Tournament circuit",
  organization: "Organization",
  competition: "Tournament",
  team: "Team",
  player: "Player",
  person: "Personnel",
  country: "Country / region",
  term: "Term",
}

/** What kind of thing a reference is, in the reader's language. Kinds this version does not know read as terms. */
export function entityKindLabel(kind: string, locale = "vi-VN") {
  const known = (Object.hasOwn(entityKindLabels, kind) ? kind : "term") as EntityKind
  return locale.startsWith("en") ? entityKindEnglish[known] : entityKindLabels[known]
}

/**
 * What text may recognize by itself. Game text only names the game, where a number like "100%" must never become a team;
 * running text (an introduction, a post, a message) can name anything, by the stricter rules of `reference-names`. A
 * reference made on purpose with "@" works in both.
 */
export type ReferenceScope = "game" | "all"
const gameReferenceKinds: ReadonlySet<EntityKind> = new Set([
  "hero",
  "skill",
  "item",
  "enchantment",
  "arcana",
  "spell",
  "term",
])

const communityKinds: ReadonlySet<EntityKind> = new Set([
  "circuit",
  "organization",
  "competition",
  "team",
  "player",
  "person",
])
/** Running text recognizes these by the rules of `reference-names`; other kinds keep those of game text everywhere. */
const namedKinds: ReadonlySet<EntityKind> = new Set([
  ...communityKinds,
  "hero",
  "item",
  "enchantment",
  "arcana",
  "spell",
  "mode",
])

export function managedCommunityReference(kind: EntityKind) {
  return communityKinds.has(kind) || kind === "country"
}

const termColors: Readonly<Record<string, readonly [string, string]>> = {
  "sat-thuong-phep": ["#7e22ce", "#d8b4fe"],
  "cong-phep": ["#7e22ce", "#d8b4fe"],
  "giap-phep": ["#7e22ce", "#d8b4fe"],
  "sat-thuong-vat-ly": ["#c2410c", "#fdba74"],
  "cong-vat-ly": ["#c2410c", "#fdba74"],
  "sat-thuong-chuan": ["#854d0e", "#fde68a"],
  "hoi-mau": ["#15803d", "#86efac"],
  "la-chan": ["#0369a1", "#7dd3fc"],
  giap: ["#0e7490", "#67e8f9"],
  "toc-chay": ["#0f766e", "#5eead4"],
  "toc-danh": ["#b45309", "#fcd34d"],
  "chi-mang": ["#be123c", "#fda4af"],
  "lam-cham": ["#1d4ed8", "#93c5fd"],
  choang: ["#1d4ed8", "#93c5fd"],
  "giam-hoi-chieu": ["#4338ca", "#a5b4fc"],
  "noi-tai": ["#57534e", "#d6d3d1"],
}

/** Semantic defaults adapt to the active color scheme; saved display colors remain authoritative. */
export function defaultEntityColor(
  entity: Pick<EntityReference, "kind" | "id"> & Partial<Pick<EntityReference, "translations">>,
) {
  if (entity.kind !== "term") return undefined
  const semantic = Object.hasOwn(termColors, entity.id)
    ? entity.id
    : entity.translations
        ?.flatMap((entry) => [entry.name, ...entry.aliases])
        .map((label) => foldSearchText(label).replace(/\s+/g, "-").trim())
        .find((label) => Object.hasOwn(termColors, label))
  const colors = semantic ? termColors[semantic] : undefined
  return colors ? `light-dark(${colors[0]}, ${colors[1]})` : undefined
}

/** `shortNames` are abbreviations, which running text only takes in the capitals they are recorded in. */
export type EntityTranslation = {
  locale: string
  name: string
  aliases: string[]
  description: string
  shortNames?: string[]
}
export type SkillReferenceOwner = {
  id: string
  kind: "hero"
  translations: EntityTranslation[]
  icon?: string | null
  iconAssetId?: string | null
}

export type EntityReference = {
  id: string
  kind: EntityKind
  translations: EntityTranslation[]
  icon?: string | null
  iconAssetId?: string | null
  autoMatch?: boolean
  /** Only the viewed hero revision supplies names for angle-bracket skill mentions. */
  matchBracketedName?: boolean
  /** Owner-qualified phrases resolved for this text only. */
  qualifiedSkillAliases?: string[]
  display?: { color?: string; underline?: boolean; showIcon?: boolean }
  destinations?: { admin?: string; wiki?: string; stream?: string }
  /** The teams a player or person was with: naming one of them in a paragraph tells their name from a common word. */
  teamIds?: string[]
  heroId?: string
  skillKey?: string
  revisionId?: string
  sourceSlot?: number | null
  variantNo?: number | null
  formKey?: string | null
  owner?: SkillReferenceOwner
  iconSource?: "REVISION" | "LIBRARY"
  unresolved?: boolean
}

export type RichTextSettings = {
  schemaVersion: 1
  autoRecognize: boolean
  fallbackLocale: string
  entities: EntityReference[]
}

export type RichTextNode =
  | { type: "paragraph"; style: ParagraphStyle; children: RichTextNode[] }
  | { type: "exampleTable"; rows: string[][] }
  | { type: "text"; text: string }
  | { type: "color"; color: string; children: RichTextNode[] }
  | { type: "strong"; children: RichTextNode[] }
  | { type: "emphasis"; children: RichTextNode[] }
  | { type: "muted"; children: RichTextNode[] }
  | { type: "reference"; entity: EntityReference; label: string; actualLocale: string; manual: boolean }

const hex = /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i
const identifier = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/
const localePattern = /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/
const word = /[\p{L}\p{N}\p{M}_]/u
const skillIdentity = /^([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})\.([a-z0-9]+(?:-[a-z0-9]+)*)$/

export function validSkillReference(entity: EntityReference): boolean {
  if (typeof entity?.id !== "string") return false
  const identity = entity.id.match(skillIdentity)
  return !!(
    identity &&
    identity[2]!.length <= 64 &&
    entity.heroId === identity[1] &&
    entity.skillKey === identity[2] &&
    typeof entity.revisionId === "string" &&
    identifier.test(entity.revisionId) &&
    entity.owner?.kind === "hero" &&
    entity.owner.id === entity.heroId &&
    Array.isArray(entity.owner.translations)
  )
}

export function referenceTranslation(
  entity: Pick<EntityReference, "translations">,
  language: string,
  fallbackLocale = "vi-VN",
) {
  if (!Array.isArray(entity.translations)) return undefined
  return (
    entity.translations.find(
      (entry) =>
        typeof entry?.locale === "string" &&
        typeof entry.name === "string" &&
        entry.locale.toLowerCase() === language.toLowerCase(),
    ) ??
    entity.translations.find(
      (entry) =>
        typeof entry?.locale === "string" &&
        typeof entry.name === "string" &&
        entry.locale.toLowerCase() === fallbackLocale.toLowerCase(),
    )
  )
}

export function extractSkillReferenceIds(text: string): string[] {
  const ids = new Set<string>()
  for (const match of text.slice(0, 100000).matchAll(/<ref=skill:([^<>]+)>([^<>]*)<\/ref>/gi)) {
    if (match[1]!.length <= 101 && skillIdentity.test(match[1]!)) ids.add(match[1]!)
    if (ids.size >= 500) break
  }
  return [...ids]
}

export function safeLinkUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value || value.length > 2048 || value !== value.trim()) return
  let decoded = value
  try {
    for (let i = 0; i < 3; i++) decoded = decodeURIComponent(decoded)
  } catch {
    return
  }
  if (/[\u0000-\u0020\u007f\\]/.test(decoded) || decoded.startsWith("//")) return
  if (value.startsWith("/") && decoded.startsWith("/") && !decoded.startsWith("//")) return value
  try {
    const url = new URL(value)
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) return value
  } catch {
    return
  }
}

export function safeEntityIconUrl(value: unknown): string | undefined {
  const url = safeLinkUrl(value)
  if (!url) return undefined
  if (!url.startsWith("/") && !url.startsWith("https://")) {
    try {
      const { protocol, hostname } = new URL(url)
      const octets = /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ? hostname.split(".").map(Number) : []
      const privateAddress =
        octets.length === 4 &&
        octets.every((part) => part >= 0 && part <= 255) &&
        (octets[0] === 127 ||
          octets[0] === 10 ||
          (octets[0] === 192 && octets[1] === 168) ||
          (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31))
      const local = hostname === "localhost" || hostname === "[::1]" || privateAddress
      if (protocol !== "http:" || !local) return undefined
    } catch {
      return undefined
    }
  }
  let decoded = url
  try {
    for (let pass = 0; pass < 3; pass++) decoded = decodeURIComponent(decoded)
  } catch {
    return undefined
  }
  return /\.svg(?:[?#]|$)/i.test(decoded) ? undefined : url
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object")
  return value as Record<string, unknown>
}

function string(value: unknown, max: number, allowEmpty = false): string {
  if (typeof value !== "string" || value.length > max || (!allowEmpty && !value.trim())) {
    throw new Error("Invalid text value")
  }
  return value
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("Expected a boolean")
  return value
}

function locale(value: unknown): string {
  const result = string(value, 64)
  if (!localePattern.test(result)) throw new Error("Invalid locale")
  return result
}

export function validateRichTextSettings(value: unknown): RichTextSettings {
  const settings = object(value)
  if (settings.schemaVersion !== 1) throw new Error("Unsupported rich text schema version")
  if (!Array.isArray(settings.entities) || settings.entities.length > 2000) throw new Error("Invalid entity catalog")
  const seen = new Set<string>()
  let catalogCharacters = 0
  const readTranslations = (value: unknown): EntityTranslation[] => {
    if (!Array.isArray(value) || !value.length || value.length > 30) throw new Error("Invalid entity translations")
    const locales = new Set<string>()
    return value.map((entry) => {
      const translation = object(entry)
      const language = locale(translation.locale)
      if (locales.has(language.toLowerCase())) throw new Error("Duplicate translation locale")
      locales.add(language.toLowerCase())
      if (!Array.isArray(translation.aliases) || translation.aliases.length > 20) throw new Error("Invalid aliases")
      const result = {
        locale: language,
        name: string(translation.name, 200),
        aliases: translation.aliases.map((alias) => string(alias, 200)),
        description: string(translation.description, 4000, true),
      }
      catalogCharacters += result.name.length + result.description.length + result.aliases.join("").length
      if (catalogCharacters > 4000000) throw new Error("Entity catalog exceeds the text size limit")
      return result
    })
  }
  const entities = settings.entities.map((entry): EntityReference => {
    const entity = object(entry)
    const id = string(entity.id, 128)
    if (!identifier.test(id) || !Object.hasOwn(entityKindLabels, entity.kind as string)) {
      throw new Error("Invalid entity identity")
    }
    const kind = entity.kind as EntityKind
    if (kind === "skill") throw new Error("Skill references are managed by the server and cannot be saved in settings")
    if (managedCommunityReference(kind) || kind === "mode")
      throw new Error("Managed references cannot be saved in Wiki settings")
    const key = `${kind}:${id}`
    if (seen.has(key)) throw new Error("Duplicate entity identity")
    seen.add(key)
    const translations = readTranslations(entity.translations)
    const result: EntityReference = { id, kind, translations }
    if (entity.autoMatch !== undefined) result.autoMatch = boolean(entity.autoMatch)
    if (entity.icon != null) {
      // A chosen silhouette is stored by name; anything else must be a picture's address.
      const glyph = typeof entity.icon === "string" && /^glyph:[a-zA-Z]{1,32}$/.test(entity.icon)
      const icon = glyph ? (entity.icon as string) : safeLinkUrl(entity.icon)
      if (!icon) throw new Error("Invalid icon URL")
      result.icon = icon
    }
    if (entity.display !== undefined) {
      const display = object(entity.display)
      result.display = {}
      if (display.color !== undefined) {
        const color = string(display.color, 9)
        if (!hex.test(color)) throw new Error("Invalid display color")
        result.display.color = color
      }
      if (display.underline !== undefined) result.display.underline = boolean(display.underline)
      if (display.showIcon !== undefined) result.display.showIcon = boolean(display.showIcon)
    }
    if (entity.destinations !== undefined) {
      const destinations = object(entity.destinations)
      result.destinations = {}
      for (const context of ["admin", "wiki"] as const) {
        if (destinations[context] !== undefined) {
          const path = safeLinkUrl(destinations[context])
          if (!path?.startsWith("/")) throw new Error("Entity destinations must be local paths")
          result.destinations[context] = path
        }
      }
    }
    return result
  })
  return {
    schemaVersion: 1,
    autoRecognize: boolean(settings.autoRecognize),
    fallbackLocale: locale(settings.fallbackLocale),
    entities,
  }
}

export function resolveEntityRoute(
  entity: EntityReference,
  context: "admin" | "wiki" | "stream",
  language?: string,
): string | undefined {
  if (entity.unresolved) return undefined
  if (context === "wiki" && managedCommunityReference(entity.kind)) return undefined
  const custom = safeLinkUrl(entity.destinations?.[context])
  // Stream opens its own pages by path and the Wiki's, another site, by their whole address.
  if (context === "stream") return custom
  if (entity.kind === "skill" && !validSkillReference(entity)) return undefined
  if (custom?.startsWith("/")) return custom
  if (!identifier.test(entity.id)) return undefined
  const id = encodeURIComponent(entity.id)
  if (entity.kind === "skill") {
    const hero = encodeURIComponent(entity.heroId!)
    const skill = encodeURIComponent(entity.skillKey!)
    if (context === "admin")
      return `/hero/${hero}?tab=skills&skill=${skill}&revision=${encodeURIComponent(entity.revisionId!)}`
    return `/?hero=${hero}&skill=${skill}${language ? `&locale=${encodeURIComponent(language)}` : ""}`
  }
  if (context === "admin") {
    if (entity.kind === "hero") return `/hero/${id}`
    if (entity.kind === "item") return `/items?item=${id}`
    if (entity.kind === "enchantment") return `/enchantments?item=${id}`
    if (entity.kind === "arcana") return `/arcana?item=${id}`
    if (entity.kind === "spell") return `/spells?item=${id}`
    if (entity.kind === "team") return `/tournaments?tab=teams&team=${id}`
    if (entity.kind === "player") return `/tournaments?tab=players&player=${id}`
    if (entity.kind === "term") return `/terminology?term=${id}`
    return undefined
  }
  if (!["hero", "item", "enchantment", "arcana", "spell", "term"].includes(entity.kind)) return undefined
  return `/?${entity.kind}=${id}${language ? `&locale=${encodeURIComponent(language)}` : ""}`
}

type Match = { entity: EntityReference; actualLocale: string }
type Trie = { children: Map<string, Trie>; match?: Match | null; localSkill?: Match | null }
/** A name running text can hold, as the characters it is looked for in. */
type IndexedName = RecognizableName & { match: Match; characters: string[] }
/** The names of running text by their first word, the longest first, and the short names among them. */
type NameIndex = { byFirstWord: Map<string, IndexedName[]>; codes: Set<string> }
export type EntityIndex = {
  root: Trie
  byId: Map<string, Match>
  /** Only an index of running text has names. */
  names?: NameIndex
  ownerSlots: Map<string, Match | null>
  bracketedSkills: Map<string, Match | null>
  accentInsensitive: boolean
}
/** The name Admin's reference tables use for {@link foldSearchText}. */
export const foldEntitySearch = foldSearchText
const fold = (value: string, accentInsensitive: boolean) =>
  accentInsensitive ? foldSearchText(value) : value.normalize("NFC").toLowerCase()
const skillMentionKey = (label: string, accentInsensitive: boolean) =>
  fold(label.trim().replace(/\s+/gu, " "), accentInsensitive)

/** Names keep their accents: two players may differ in nothing else. */
const foldName = (value: string) => plainPunctuation(value).toLowerCase()

function addNames(index: NameIndex, match: Match, translation: EntityTranslation) {
  const { entity } = match
  const add = (label: string, form: NameForm) => {
    const name = label.trim()
    if (!name || name.length > 200) return
    const rule = nameRule(entity.kind, name, form)
    const folded = foldName(name)
    const first = folded.match(/^[\p{L}\p{N}\p{M}_]+/u)?.[0]
    if (rule === "never" || !first) return
    const written = plainPunctuation(name)
    const entry = { kind: entity.kind, written, rule, match, characters: Array.from(folded) }
    const bucket = index.byFirstWord.get(first)
    if (bucket) bucket.push(entry)
    else index.byFirstWord.set(first, [entry])
    if (rule === "code") index.codes.add(written)
  }
  add(translation.name, "name")
  for (const name of translation.shortNames ?? []) add(name, "short")
  for (const alias of translation.aliases) add(alias, "alias")
}

/** Only callers with a complete set of skills for the owner may enable slot mentions. */
function skillSlotNames(entity: EntityReference) {
  const slot = entity.sourceSlot
  if (slot == null || !Number.isInteger(slot) || slot < 0) return []
  return slot === 0 ? ["nội tại"] : slot === 3 ? ["chiêu 3", "chiêu cuối"] : [`chiêu ${slot}`]
}

/** Editors write a skill's later forms in any of these ways. */
function skillVariantNames(entity: EntityReference) {
  const variant = entity.variantNo
  if (variant == null || !Number.isInteger(variant) || variant < 1) return []
  return skillSlotNames(entity).flatMap((slot) =>
    ["giai đoạn", "biến thể", "dạng"].map((word) => `${slot} ${word} ${variant}`),
  )
}

export function createEntityIndex(
  entities: EntityReference[],
  language: string,
  fallbackLocale: string,
  options: { accentInsensitive?: boolean; scope?: ReferenceScope } = {},
): EntityIndex {
  const root: Trie = { children: new Map() }
  const byId = new Map<string, Match>()
  const ownerSlots = new Map<string, Match | null>()
  const bracketedSkills = new Map<string, Match | null>()
  const accentInsensitive = options.accentInsensitive === true
  const running: NameIndex | undefined =
    options.scope === "all" ? { byFirstWord: new Map(), codes: new Set() } : undefined
  let catalogEntries = 0
  let skillEntries = 0
  let communityEntries = 0
  let countryEntries = 0
  // Explicit skill lookups have a separate budget so a full catalog does not hide saved references.
  for (const entry of Array.isArray(entities) ? entities : []) {
    if (
      !entry ||
      typeof entry.id !== "string" ||
      !identifier.test(entry.id) ||
      !Object.hasOwn(entityKindLabels, entry.kind) ||
      !Array.isArray(entry.translations)
    )
      continue
    if (entry.kind === "skill") {
      if (skillEntries >= 500 || !validSkillReference(entry)) continue
      skillEntries++
    } else if (entry.kind === "country") {
      if (countryEntries++ >= 64) continue
    } else if (managedCommunityReference(entry.kind)) {
      if (communityEntries++ >= 10000) continue
    } else if (catalogEntries++ >= 2000) continue
    const translations = entry.translations
      .slice(0, 30)
      .filter(
        (translation) =>
          translation &&
          typeof translation.locale === "string" &&
          typeof translation.name === "string" &&
          typeof translation.description === "string" &&
          Array.isArray(translation.aliases),
      )
      .map((translation) => ({
        ...translation,
        aliases: translation.aliases.filter((alias) => typeof alias === "string").slice(0, 20),
        ...(Array.isArray(translation.shortNames)
          ? { shortNames: translation.shortNames.filter((name) => typeof name === "string").slice(0, 20) }
          : {}),
      }))
    const entity = { ...entry, translations }
    const translation =
      entity.translations.find((item) => item.locale.toLowerCase() === language.toLowerCase()) ??
      entity.translations.find((item) => item.locale.toLowerCase() === fallbackLocale.toLowerCase())
    if (!translation) continue
    const match = { entity, actualLocale: translation.locale }
    byId.set(`${entity.kind}:${entity.id}`, match)
    if (entity.kind === "skill" && entity.matchBracketedName) {
      const name = skillMentionKey(translation.name, accentInsensitive)
      if (name && name.length <= 200 && !/[<>]/u.test(name)) {
        for (const label of [
          `<${name}>`,
          ...skillSlotNames(entity).map((slot) => `${fold(slot, accentInsensitive)} <${name}>`),
        ]) {
          const existing = bracketedSkills.get(label)
          bracketedSkills.set(label, existing === undefined || existing?.entity.id === entity.id ? match : null)
        }
      }
    }
    if ((options.scope ?? "game") === "game" && !gameReferenceKinds.has(entity.kind)) continue
    if (entity.autoMatch === false || (!["hero", "term"].includes(entity.kind) && entity.autoMatch !== true)) continue
    if (running && namedKinds.has(entity.kind)) {
      addNames(running, match, translation)
      continue
    }
    const slots = entity.kind === "skill" ? skillSlotNames(entity) : []
    const variants = entity.kind === "skill" && !entity.qualifiedSkillAliases ? skillVariantNames(entity) : []
    if (slots.length) {
      const key = `${entity.heroId}:${entity.sourceSlot}`
      const previous = ownerSlots.get(key)
      // A later form means the slot has several, so the bare slot can no longer name just one of them.
      const shared = (entity.variantNo ?? 0) > 1
      ownerSlots.set(key, !shared && (previous === undefined || previous?.entity.id === entity.id) ? match : null)
      if (entity.variantNo != null) ownerSlots.set(`${key}:${entity.variantNo}`, match)
    }
    const owner = entity.owner && referenceTranslation(entity.owner, language, fallbackLocale)
    const names =
      entity.kind === "skill"
        ? (entity.qualifiedSkillAliases ??
          [...slots, ...variants].flatMap((label) =>
            owner ? [label, `${label} ${owner.name}`, `${label} của ${owner.name}`] : [label],
          ))
        : [translation.name, ...translation.aliases.slice(0, 20)]
    for (const alias of names) {
      const name = fold(alias.trim(), accentInsensitive)
      // A code made only of digits reads as a number in running text, so only "@" can reach it.
      if (!name || name.length > 200 || !/\p{L}/u.test(name)) continue
      let node = root
      for (const character of name) {
        let child = node.children.get(character)
        if (!child) {
          child = { children: new Map() }
          node.children.set(character, child)
        }
        node = child
      }
      const property = slots.includes(alias) || variants.includes(alias) ? "localSkill" : "match"
      const existing = node[property]
      if (existing === undefined) node[property] = match
      else if (existing && (existing.entity.id !== entity.id || existing.entity.kind !== entity.kind))
        node[property] = null
    }
  }
  for (const bucket of running?.byFirstWord.values() ?? [])
    bucket.sort((a, b) => b.characters.length - a.characters.length)
  return { root, byId, names: running, ownerSlots, bracketedSkills, accentInsensitive }
}

const secondsAfterNumber = /^(?:[.,]\d+)?\s*(?:gi[âa]y|s)(?![\p{L}\p{M}\p{N}_])/iu

/** A skill number followed by seconds is an amount of cooldown, and does not name that skill. */
function skillNumberCountsSeconds(label: string, after: string) {
  return /^chi[eê]u\s+\d+$/iu.test(label.normalize("NFC")) && secondsAfterNumber.test(after.normalize("NFC"))
}

export type RichTextOptions = {
  autoRecognize?: boolean
  firstOccurrenceOnly?: boolean
  maxLength?: number
  maxDepth?: number
  maxReferences?: number
  onOwnerFirstSkill?: (heroId: string, slot: number, variant?: number) => void
  /**
   * `references` reads text people write by hand: references are its only markup, other tags stay as typed, and each
   * paragraph (a blank line ends one) is recognized by itself.
   */
  markup?: "all" | "references"
  /** Records, as `kind:id`, the text is about or stands on the page of: it names them, but never links them. */
  exclude?: ReadonlySet<string>
  /** The record, as `kind:id`, whose page an address opens. */
  resolveAddress?: (address: string) => string | undefined
}

const richTextTokens = new RegExp(
  `<color=#(?:[\\da-f]{3}|[\\da-f]{6}|[\\da-f]{8})>|<ref=(?:${referenceKinds}):[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}>` +
    "|<(?:noauto|b|i|muted|note|info|example|exampletable)>" +
    "|<\\/(?:color|ref|noauto|b|i|muted|note|info|example|exampletable)>",
  "gi",
)
const referenceTokens = new RegExp(`<ref=(?:${referenceKinds}):[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}>|<\\/ref>`, "gi")

export function parseRichText(input: string, index: EntityIndex, options: RichTextOptions = {}): RichTextNode[] {
  if (options.markup !== "references") return parseParagraph(input, index, options)
  const nodes: RichTextNode[] = []
  let left = Math.max(0, Math.min(500, options.maxReferences ?? 500))
  // The blank lines between paragraphs are kept as text, so the parts add up to the whole.
  for (const part of input.split(/(\n[^\S\n]*(?:\n[^\S\n]*)+)/)) {
    const parsed = parseParagraph(part, index, { ...options, maxReferences: left })
    left -= parsed.filter((node) => node.type === "reference").length
    nodes.push(...parsed)
  }
  return nodes
}

/** The teams a paragraph names, which tell the names of their players from common words. */
function teamsNamed(source: string, index: EntityIndex, options: RichTextOptions) {
  const nodes = parseParagraph(source, index, { markup: options.markup, resolveAddress: options.resolveAddress }, false)
  const teams = new Set<string>()
  const collect = (list: RichTextNode[]) => {
    for (const node of list) {
      if (node.type === "reference" && node.entity.kind === "team") teams.add(node.entity.id)
      else if ("children" in node) collect(node.children)
    }
  }
  collect(nodes)
  for (const key of options.exclude ?? []) if (key.startsWith("team:")) teams.add(key.slice(5))
  return teams
}

function parseParagraph(input: string, index: EntityIndex, options: RichTextOptions, people = true): RichTextNode[] {
  const limit = (value: number | undefined, maximum: number) =>
    Number.isFinite(value) ? Math.max(0, Math.min(maximum, Math.floor(value!))) : maximum
  const maxLength = limit(options.maxLength, 100000)
  const source = input.slice(0, maxLength)
  const maxDepth = limit(options.maxDepth, 8)
  const maxReferences = limit(options.maxReferences, 500)
  let references = 0
  const recognized = new Set<string>()
  const tokens = Array.from(source.matchAll(options.markup === "references" ? referenceTokens : richTextTokens))
  let teams: Set<string> | undefined
  const pairs = new Map<number, number>()
  const stack: { index: number; kind: string }[] = []
  tokens.forEach((token, position) => {
    const kind = token[0].match(/^<\/?([a-z]+)/i)![1]!.toLowerCase()
    if (token[0].startsWith("</")) {
      if (stack.at(-1)?.kind === kind) {
        const open = stack.pop()!
        pairs.set(open.index, position)
      } else stack.length = 0
    } else stack.push({ index: position, kind })
  })
  function append(nodes: RichTextNode[], text: string) {
    if (!text) return
    const previous = nodes.at(-1)
    if (previous?.type === "text") previous.text += text
    else nodes.push({ type: "text", text })
  }
  function recognize(text: string, enabled: boolean): RichTextNode[] {
    if (!enabled || references >= maxReferences) return text ? [{ type: "text", text }] : []
    if (index.names) return recognizeAddresses(text)
    if (!index.bracketedSkills.size || !text.includes("<")) return recognizeAliases(text)
    const nodes: RichTextNode[] = []
    let cursor = 0
    for (const bracket of text.matchAll(/<([^<>]{1,200})>/gu)) {
      const name = `<${skillMentionKey(bracket[1]!, index.accentInsensitive)}>`
      if (!index.bracketedSkills.has(name)) continue
      const before = text.slice(Math.max(cursor, bracket.index - 200), bracket.index)
      const prefix = before.match(/(?:^|[^\p{L}\p{M}\p{N}_])([\p{L}\p{M}]+\s+[\p{L}\p{M}\p{N}]+\s+)$/u)?.[1] ?? ""
      const qualified =
        prefix && index.bracketedSkills.get(`${skillMentionKey(prefix, index.accentInsensitive)} ${name}`)
      const match = qualified || index.bracketedSkills.get(name)
      if (!match) continue
      const start = qualified ? bracket.index - prefix.length : bracket.index
      nodes.push(...recognizeAliases(text.slice(cursor, start)))
      cursor = start
      if (references >= maxReferences) break
      cursor = bracket.index + bracket[0].length
      nodes.push({ type: "reference", ...match, label: text.slice(start, cursor), manual: false })
      recognized.add(`skill:${match.entity.id}`)
      references++
      if (references >= maxReferences) break
    }
    nodes.push(...recognizeAliases(text.slice(cursor)))
    return nodes
  }
  /** The address of one of our pages reads as that page; nothing inside any other address is a name. */
  function recognizeAddresses(text: string): RichTextNode[] {
    const nodes: RichTextNode[] = []
    let cursor = 0
    for (const found of text.matchAll(addressPattern)) {
      const address = trimAddress(found[0])
      nodes.push(...recognizeAliases(text.slice(cursor, found.index)))
      cursor = found.index + address.length
      const key = options.resolveAddress?.(address)
      const match = key ? index.byId.get(key) : undefined
      const name = match && referenceTranslation(match.entity, match.actualLocale)?.name
      if (!key || !match || !name || options.exclude?.has(key) || references >= maxReferences) append(nodes, address)
      else if (options.firstOccurrenceOnly && recognized.has(key)) append(nodes, name)
      else {
        nodes.push({ type: "reference", ...match, label: name, manual: false })
        recognized.add(key)
        references++
      }
    }
    nodes.push(...recognizeAliases(text.slice(cursor)))
    return nodes
  }
  function recognizeAliases(text: string): RichTextNode[] {
    if (!text || references >= maxReferences) return text ? [{ type: "text", text }] : []
    const chars: { char: string; start: number; end: number }[] = []
    for (const cluster of text.matchAll(/\P{M}\p{M}*|\p{M}+/gu)) {
      for (const char of index.names ? foldName(cluster[0]) : fold(cluster[0], index.accentInsensitive))
        chars.push({ char, start: cluster.index, end: cluster.index + cluster[0].length })
    }
    const nodes: RichTextNode[] = []
    let cursor = 0
    for (let start = 0; start < chars.length && references < maxReferences; start++) {
      if (start > 0 && word.test(chars[start - 1]!.char)) continue
      let node = index.root
      let best: { match: Match; end: number } | undefined
      for (let end = start; end < chars.length && end - start < 200; end++) {
        const next = node.children.get(chars[end]!.char)
        if (!next) break
        node = next
        if (chars[end + 1] && word.test(chars[end + 1]!.char)) continue
        let match = node.match
        if (node.localSkill) {
          const previous = nodes.at(-1)
          const followsHero =
            previous?.type === "reference" &&
            previous.entity.kind === "hero" &&
            /^\s+$/u.test(text.slice(cursor, chars[start]!.start))
          if (!followsHero && !hasFollowingOwner(end)) match = node.localSkill
        }
        if (match) best = { match, end }
      }
      const named = index.names && nameAt(index.names, start)
      if (named && (!best || named.end >= best.end)) {
        if (!named.match || options.exclude?.has(`${named.match.entity.kind}:${named.match.entity.id}`)) {
          // The longest name here leads nowhere, so nothing shorter inside it is taken for another name either.
          start = named.end
          continue
        }
        best = { match: named.match, end: named.end }
      }
      if (!best) continue
      if (
        skillNumberCountsSeconds(
          text.slice(chars[start]!.start, chars[best.end]!.end),
          text.slice(chars[best.end]!.end),
        )
      )
        continue
      if (best.match.entity.kind === "hero" && (index.ownerSlots.size || options.onOwnerFirstSkill)) {
        best = ownerFirstSkill(best.match.entity.id, best.end) ?? best
      }
      const key = `${best.match.entity.kind}:${best.match.entity.id}`
      if (options.firstOccurrenceOnly && recognized.has(key)) {
        // A name that stays plain the second time is still one name, so no shorter one is found inside it.
        if (index.names) start = best.end
        continue
      }
      append(nodes, text.slice(cursor, chars[start]!.start))
      const end = chars[best.end]!.end
      nodes.push({ type: "reference", ...best.match, label: text.slice(chars[start]!.start, end), manual: false })
      references++
      recognized.add(key)
      cursor = end
      start = best.end
    }
    append(nodes, text.slice(cursor))
    return nodes

    /** The longest name of running text that starts here; without a match it names several records. */
    function nameAt(names: NameIndex, start: number): { match: Match | null; end: number } | undefined {
      if (joinsWords(start - 1, -1)) return
      let wordEnd = start
      while (chars[wordEnd] && word.test(chars[wordEnd]!.char)) wordEnd++
      const bucket = names.byFirstWord.get(
        chars
          .slice(start, wordEnd)
          .map(({ char }) => char)
          .join(""),
      )
      const found = new Map<string, { match: Match; strength: NameStrength }>()
      let length = 0
      for (const name of bucket ?? []) {
        if (found.size && name.characters.length < length) break
        const end = start + name.characters.length - 1
        if (!name.characters.every((char, at) => chars[start + at]?.char === char)) continue
        if (word.test(chars[end + 1]?.char ?? " ") || joinsWords(end + 1, 1)) continue
        const { entity } = name.match
        if (!people && (entity.kind === "player" || entity.kind === "person")) continue
        const from = chars[start]!.start
        const to = chars[end]!.end
        const strength = nameStrength(
          name,
          text.slice(from, to),
          {
            before: text.slice(Math.max(0, from - 120), from),
            after: text.slice(to, to + 120),
            afterReference: nodes.at(-1)?.type === "reference" && !text.slice(cursor, from).trim(),
            isCode: (code) => names.codes.has(code),
          },
          () => {
            teams ??= teamsNamed(source, index, options)
            return !!entity.teamIds?.some((id) => teams!.has(id))
          },
        )
        if (!strength) continue
        length = name.characters.length
        const key = `${entity.kind}:${entity.id}`
        if (found.get(key)?.strength !== "introduced") found.set(key, { match: name.match, strength })
      }
      if (!found.size) return
      // A word that says what the name is settles which of several records it names.
      const introduced = [...found.values()].filter(({ strength }) => strength === "introduced")
      const meant = introduced.length ? introduced : [...found.values()]
      return { match: meant.length === 1 ? meant[0]!.match : null, end: start + length - 1 }
    }

    /** A dot or an at sign with a word on its other side belongs to a domain or an e-mail address. */
    function joinsWords(at: number, step: 1 | -1) {
      const sign = chars[at]?.char
      return (sign === "." || sign === "@") && word.test(chars[at + step]?.char ?? " ")
    }

    function ownerFirstSkill(heroId: string, end: number) {
      const afterOwner = chars[end]!.end
      const tail = text.slice(afterOwner, afterOwner + 201).normalize("NFC")
      const suffix = tail.match(/^\s+(?:chiêu\s+(cuối|[1-9]\d?)|nội\s+tại)(?![\p{L}\p{M}\p{N}_])/iu)
      if (!suffix) return
      const rest = tail.slice(suffix[0].length)
      if (secondsAfterNumber.test(rest)) return
      const form = rest.match(/^\s+(?:giai\s+đoạn|biến\s+thể|dạng)\s+([1-9]\d?)(?![\p{L}\p{M}\p{N}_])/iu)
      const number = suffix[1]?.toLowerCase()
      const slot = number === "cuối" ? 3 : Number(number ?? 0)
      // The normalized suffix and the folded character array each count one position per letter.
      end += Array.from(suffix[0]).length
      if (end >= chars.length || hasFollowingOwner(end)) return
      const variant = form ? Number(form[1]) : undefined
      options.onOwnerFirstSkill?.(heroId, slot, variant)
      // The longer phrase is only a reference when that form exists; otherwise the words after the slot stay plain text.
      const named = variant ? index.ownerSlots.get(`${heroId}:${slot}:${variant}`) : undefined
      if (named) return { match: named, end: end + Array.from(form![0]).length }
      const match = index.ownerSlots.get(`${heroId}:${slot}`)
      if (match) return { match, end }
    }

    function hasFollowingOwner(end: number) {
      const tail = text.slice(chars[end]!.end, chars[end]!.end + 201)
      return /^\s+(?:của\s|đối phương|đồng minh|kẻ địch)/iu.test(tail) || followingHero(end + 1)
    }

    function followingHero(start: number) {
      while (chars[start] && /\s/u.test(chars[start]!.char)) start++
      let node: Trie | undefined = index.root
      for (let i = start; i < chars.length && i - start < 200; i++) {
        node = node.children.get(chars[i]!.char)
        if (!node) break
        if (node.match?.entity.kind === "hero" && (!chars[i + 1] || !word.test(chars[i + 1]!.char))) return true
      }
      return false
    }
  }
  function parse(from: number, to: number, firstToken: number, depth: number, auto: boolean): RichTextNode[] {
    if (depth >= maxDepth) return [{ type: "text", text: source.slice(from, to) }]
    const nodes: RichTextNode[] = []
    let cursor = from
    for (let position = firstToken; position < tokens.length; position++) {
      const token = tokens[position]!
      if (token.index >= to) break
      if (token.index < cursor) continue
      nodes.push(...recognize(source.slice(cursor, token.index), auto))
      const closePosition = pairs.get(position)
      if (closePosition === undefined) {
        if (!token[0].startsWith("</")) {
          append(nodes, source.slice(token.index, to))
          return nodes
        }
        append(nodes, token[0])
        cursor = token.index + token[0].length
        continue
      }
      const close = tokens[closePosition]!
      const contentStart = token.index + token[0].length
      const end = close.index + close[0].length
      const tag = token[0].toLowerCase()
      const style = tag.slice(1, -1)
      if (style === "exampletable") {
        const rows = readExampleTable(source.slice(contentStart, close.index))
        if (rows) nodes.push({ type: "exampleTable", rows })
        else append(nodes, source.slice(token.index, end))
      } else if (isParagraphStyle(style)) {
        nodes.push({
          type: "paragraph",
          style,
          children: parse(contentStart, close.index, position + 1, depth + 1, auto),
        })
      } else if (tag.startsWith("<ref=")) {
        const key = token[0].slice(5, -1).replace(/^[^:]+/, (kind) => kind.toLowerCase())
        const match = index.byId.get(key)
        if (match ? options.exclude?.has(key) : options.markup === "references")
          append(nodes, source.slice(contentStart, close.index))
        else if (match && references < maxReferences) {
          nodes.push({ type: "reference", ...match, label: source.slice(contentStart, close.index), manual: true })
          // In running text a name linked on purpose is linked already.
          if (index.names) recognized.add(key)
          references++
        } else if (references < maxReferences && /^(?:team|player):/.test(key)) {
          const [kind, id] = key.split(":") as ["team" | "player", string]
          const label = source.slice(contentStart, close.index)
          nodes.push({
            type: "reference",
            entity: {
              id,
              kind,
              unresolved: true,
              translations: [
                {
                  locale: "vi-VN",
                  name: label,
                  aliases: [],
                  description: "Chưa có thông tin công khai cho tham chiếu này.",
                },
                {
                  locale: "en-US",
                  name: label,
                  aliases: [],
                  description: "There is no public information for this reference yet.",
                },
              ],
            },
            label,
            actualLocale: "vi-VN",
            manual: true,
          })
          references++
        } else append(nodes, source.slice(token.index, end))
      } else if (tag === "<noauto>") nodes.push(...parse(contentStart, close.index, position + 1, depth + 1, false))
      else if (tag === "<muted>")
        nodes.push({ type: "muted", children: parse(contentStart, close.index, position + 1, depth + 1, auto) })
      else if (tag === "<b>" || tag === "<i>")
        nodes.push({
          type: tag === "<b>" ? "strong" : "emphasis",
          children: parse(contentStart, close.index, position + 1, depth + 1, auto),
        })
      else
        nodes.push({
          type: "color",
          color: token[0].slice(7, -1),
          children: parse(contentStart, close.index, position + 1, depth + 1, auto),
        })
      cursor = end
      position = closePosition
    }
    nodes.push(...recognize(source.slice(cursor, to), auto))
    return nodes
  }
  const result = parse(0, source.length, 0, 0, options.autoRecognize !== false)
  if (input.length > maxLength) append(result, "…")
  return result
}
