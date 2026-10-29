export const entityKindLabels = {
  hero: "Tướng",
  skill: "Kỹ năng",
  item: "Trang bị",
  enchantment: "Phù hiệu",
  arcana: "Bảng ngọc",
  spell: "Phụ trợ",
  team: "Đội tuyển",
  player: "Tuyển thủ",
  country: "Quốc gia / khu vực",
  term: "Thuật ngữ",
} as const
export type EntityKind = keyof typeof entityKindLabels

export function managedCommunityReference(kind: EntityKind) {
  return kind === "team" || kind === "player" || kind === "country"
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
        .map((label) => foldEntitySearch(label).replace(/\s+/g, "-").trim())
        .find((label) => Object.hasOwn(termColors, label))
  const colors = semantic ? termColors[semantic] : undefined
  return colors ? `light-dark(${colors[0]}, ${colors[1]})` : undefined
}

export type EntityTranslation = { locale: string; name: string; aliases: string[]; description: string }
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
  display?: { color?: string; underline?: boolean; showIcon?: boolean }
  destinations?: { admin?: string; wiki?: string }
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
  | { type: "text"; text: string }
  | { type: "color"; color: string; children: RichTextNode[] }
  | { type: "strong"; children: RichTextNode[] }
  | { type: "emphasis"; children: RichTextNode[] }
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
    if (managedCommunityReference(kind)) throw new Error("Managed references cannot be saved in Wiki settings")
    const key = `${kind}:${id}`
    if (seen.has(key)) throw new Error("Duplicate entity identity")
    seen.add(key)
    const translations = readTranslations(entity.translations)
    const result: EntityReference = { id, kind, translations }
    if (entity.autoMatch !== undefined) result.autoMatch = boolean(entity.autoMatch)
    if (entity.icon != null) {
      const icon = safeLinkUrl(entity.icon)
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

export function resolveEntityRoute(entity: EntityReference, context: "admin" | "wiki", language?: string) {
  if (entity.unresolved) return undefined
  if (context === "wiki" && managedCommunityReference(entity.kind)) return undefined
  const custom = safeLinkUrl(entity.destinations?.[context])
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
type Trie = { children: Map<string, Trie>; match?: Match | null }
export type EntityIndex = { root: Trie; byId: Map<string, Match>; accentInsensitive: boolean }
export const foldEntitySearch = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase()
const fold = (value: string, accentInsensitive: boolean) =>
  accentInsensitive ? foldEntitySearch(value) : value.normalize("NFC").toLowerCase()

export function createEntityIndex(
  entities: EntityReference[],
  language: string,
  fallbackLocale: string,
  options: { accentInsensitive?: boolean } = {},
): EntityIndex {
  const root: Trie = { children: new Map() }
  const byId = new Map<string, Match>()
  const accentInsensitive = options.accentInsensitive === true
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
      if (communityEntries++ >= 1000) continue
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
      }))
    const entity = { ...entry, translations }
    const translation =
      entity.translations.find((item) => item.locale.toLowerCase() === language.toLowerCase()) ??
      entity.translations.find((item) => item.locale.toLowerCase() === fallbackLocale.toLowerCase())
    if (!translation) continue
    const match = { entity, actualLocale: translation.locale }
    byId.set(`${entity.kind}:${entity.id}`, match)
    if (
      entity.kind === "skill" ||
      entity.autoMatch === false ||
      (!["hero", "term"].includes(entity.kind) && entity.autoMatch !== true)
    )
      continue
    for (const alias of [translation.name, ...translation.aliases.slice(0, 20)]) {
      const name = fold(alias.trim(), accentInsensitive)
      if (!name || name.length > 200) continue
      let node = root
      for (const character of name) {
        let child = node.children.get(character)
        if (!child) {
          child = { children: new Map() }
          node.children.set(character, child)
        }
        node = child
      }
      if (node.match === undefined) node.match = match
      else if (node.match && (node.match.entity.id !== entity.id || node.match.entity.kind !== entity.kind))
        node.match = null
    }
  }
  return { root, byId, accentInsensitive }
}

export function parseRichText(
  input: string,
  index: EntityIndex,
  options: {
    autoRecognize?: boolean
    firstOccurrenceOnly?: boolean
    maxLength?: number
    maxDepth?: number
    maxReferences?: number
  } = {},
): RichTextNode[] {
  const limit = (value: number | undefined, maximum: number) =>
    Number.isFinite(value) ? Math.max(0, Math.min(maximum, Math.floor(value!))) : maximum
  const maxLength = limit(options.maxLength, 100000)
  const source = input.slice(0, maxLength)
  const maxDepth = limit(options.maxDepth, 8)
  const maxReferences = limit(options.maxReferences, 500)
  let references = 0
  const recognized = new Set<string>()
  const tokens = Array.from(
    source.matchAll(
      /<color=#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})>|<ref=(?:hero|skill|item|enchantment|arcana|spell|team|player|country|term):[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}>|<(?:noauto|b|i)>|<\/(?:color|ref|noauto|b|i)>/gi,
    ),
  )
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
    const chars: { char: string; start: number; end: number }[] = []
    for (const cluster of text.matchAll(/\P{M}\p{M}*|\p{M}+/gu)) {
      for (const char of fold(cluster[0], index.accentInsensitive))
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
        if (node.match && (!chars[end + 1] || !word.test(chars[end + 1]!.char))) best = { match: node.match, end }
      }
      if (!best) continue
      const key = `${best.match.entity.kind}:${best.match.entity.id}`
      if (options.firstOccurrenceOnly && recognized.has(key)) continue
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
      if (tag.startsWith("<ref=")) {
        const key = token[0].slice(5, -1).replace(/^[^:]+/, (kind) => kind.toLowerCase())
        const match = index.byId.get(key)
        if (match && references < maxReferences) {
          nodes.push({ type: "reference", ...match, label: source.slice(contentStart, close.index), manual: true })
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
              ],
            },
            label,
            actualLocale: "vi-VN",
            manual: true,
          })
          references++
        } else append(nodes, source.slice(token.index, end))
      } else if (tag === "<noauto>") nodes.push(...parse(contentStart, close.index, position + 1, depth + 1, false))
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
