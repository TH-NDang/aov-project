import type { GameplayIconName } from "../components/gameplay-icons"

/**
 * Item entries keep their stats and passives as free text in the description: a "+60 <stat>" line for each stat,
 * then "<passive name>: <effect>" lines. This turns that text into something a reader can scan and filter, without
 * changing what is stored. Lines the parser does not recognise stay as plain passive text, so nothing is ever lost.
 */
export type ItemStatKey =
  | "physicalAttack"
  | "magicAttack"
  | "maxHealth"
  | "armor"
  | "magicDefense"
  | "attackSpeed"
  | "movementSpeed"
  | "cooldownReduction"
  | "criticalChance"
  | "criticalDamage"
  | "lifesteal"
  | "magicLifesteal"
  | "armorPierce"
  | "magicPierce"
  | "healthRegen"
  | "manaRegen"
  | "maxMana"
  | "tenacity"

export interface ItemStatDefinition {
  key: ItemStatKey
  vi: string
  en: string
  icon: GameplayIconName
  /** Accent-free, lowercase spellings seen in the data, including recurring typos. */
  spellings: string[]
}

export const ITEM_STATS: ItemStatDefinition[] = [
  { key: "physicalAttack", vi: "Công vật lý", en: "Physical attack", icon: "sword", spellings: ["cong vat ly"] },
  { key: "magicAttack", vi: "Công phép", en: "Magic attack", icon: "orb", spellings: ["cong phep"] },
  { key: "maxHealth", vi: "Máu tối đa", en: "Max HP", icon: "heart", spellings: ["mau toi da", "mau"] },
  { key: "armor", vi: "Giáp", en: "Armor", icon: "shield", spellings: ["giap"] },
  { key: "magicDefense", vi: "Giáp phép", en: "Magic defense", icon: "runeShield", spellings: ["giap phep"] },
  { key: "attackSpeed", vi: "Tốc đánh", en: "Attack speed", icon: "bolt", spellings: ["toc danh", "toc dang"] },
  { key: "movementSpeed", vi: "Tốc chạy", en: "Movement speed", icon: "boot", spellings: ["toc chay"] },
  {
    key: "cooldownReduction",
    vi: "Giảm hồi chiêu",
    en: "Cooldown reduction",
    icon: "cooldown",
    spellings: ["giam hoi chieu"],
  },
  { key: "criticalChance", vi: "Tỷ lệ chí mạng", en: "Critical chance", icon: "crit", spellings: ["ty le chi mang"] },
  {
    key: "criticalDamage",
    vi: "Sát thương chí mạng",
    en: "Critical damage",
    icon: "crit",
    spellings: ["sat thuong chi mang"],
  },
  { key: "lifesteal", vi: "Hút máu", en: "Lifesteal", icon: "vamp", spellings: ["hut mau"] },
  { key: "magicLifesteal", vi: "Hút máu phép", en: "Magic lifesteal", icon: "vamp", spellings: ["hut mau phep"] },
  { key: "armorPierce", vi: "Xuyên giáp", en: "Armor pierce", icon: "pierce", spellings: ["xuyen giap"] },
  { key: "magicPierce", vi: "Xuyên giáp phép", en: "Magic pierce", icon: "pierce", spellings: ["xuyen giap phep"] },
  { key: "healthRegen", vi: "Hồi máu/5s", en: "HP regen/5s", icon: "heart", spellings: ["hoi mau/5s"] },
  { key: "manaRegen", vi: "Hồi năng lượng/5s", en: "Mana regen/5s", icon: "mana", spellings: ["hoi nang luong/5s"] },
  {
    key: "maxMana",
    vi: "Năng lượng tối đa",
    en: "Max mana",
    icon: "mana",
    spellings: ["nang luong toi da", "nang luong"],
  },
  { key: "tenacity", vi: "Kháng hiệu ứng", en: "Tenacity", icon: "barrier", spellings: ["khang hieu ung"] },
]

const DEFINITIONS = new Map(ITEM_STATS.flatMap((stat) => stat.spellings.map((spelling) => [spelling, stat] as const)))

export interface ItemTextStat {
  /** Null when the label is not a stat the wiki knows; the original label is still shown. */
  key: ItemStatKey | null
  label: string
  value: number
  percent: boolean
  /** Granted by a unique passive, so it does not stack with another copy. */
  unique: boolean
  note: string | null
}

export interface ItemTextPassive {
  name: string | null
  text: string
  unique: boolean
}

export interface ItemTextContent {
  stats: ItemTextStat[]
  passives: ItemTextPassive[]
  /** Lines written entirely in parentheses: flavour text or a side remark. */
  notes: string[]
}

function folded(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

const UNIQUE = /n[oộ]i\s+t[aạ]i\s+duy\s+nh[aấ]t/i
const STAT_LINE = /^["'“”\s]*(\+)?\s*(\d[\d.,]*)\s*(%?)\s+(.+)$/
const SEPARATOR = /\s+[–—-]\s+/

function numberFrom(text: string) {
  if (/^\d{1,3}(\.\d{3})+$/.test(text)) return Number(text.replaceAll(".", ""))
  return Number(text.replace(",", "."))
}

function statFrom(line: string): ItemTextStat | null {
  const match = STAT_LINE.exec(line)
  if (!match) return null
  const [, plus, amount, percent, rest] = match
  const value = numberFrom(amount)
  if (!Number.isFinite(value)) return null

  const hint = /\(([^)]*)\)\s*$/.exec(rest)
  const body = hint ? rest.slice(0, hint.index).trim() : rest.trim()
  const [base, ...details] = body.split(SEPARATOR)
  const definition = DEFINITIONS.get(folded(base))
  // A sentence can start with a number too, such as a cooldown; without a plus the line must name a known stat.
  if (!definition && (!plus || details.length > 0 || base.split(" ").length > 4)) return null

  const unique = UNIQUE.test(body)
  const note = [
    ...details.map((detail) =>
      detail
        .replace(UNIQUE, "")
        .replace(/^[\s:–—-]+|[\s:–—-]+$/g, "")
        .trim(),
    ),
    hint?.[1]?.trim(),
  ]
    .filter(Boolean)
    .join(" · ")
  return {
    key: definition?.key ?? null,
    label: definition?.vi ?? base,
    value,
    percent: percent === "%",
    unique,
    note: note || null,
  }
}

function passiveFrom(line: string): ItemTextPassive {
  const unique = UNIQUE.test(line)
  const text = unique
    ? line
        .replace(new RegExp(`\\s*[–—-]?\\s*${UNIQUE.source}\\s*[.:–—-]?\\s*`, "i"), " ")
        .replace(/\s+/g, " ")
        .trim()
    : line
  const label = /^([^:.,;()\d]{2,40}?)(?:\s*:\s*|\s+[–—-]\s+)(.+)$/s.exec(text)
  if (label && label[1].trim().split(/\s+/).length <= 5) {
    return { name: label[1].trim(), text: label[2].trim(), unique }
  }
  return { name: null, text, unique }
}

export function parseItemDescription(description: string | null | undefined): ItemTextContent {
  const content: ItemTextContent = { stats: [], passives: [], notes: [] }
  for (const raw of (description ?? "").split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (/^\((?![+\d])[^)]*\)?\s*\.?$/.test(line)) {
      content.notes.push(line.replace(/^\(|\)?\s*\.?$/g, "").trim())
      continue
    }
    const stat = statFrom(line)
    if (stat) content.stats.push(stat)
    else content.passives.push(passiveFrom(line))
  }
  return content
}

export function itemStatDefinition(key: ItemStatKey | null) {
  return key ? ITEM_STATS.find((stat) => stat.key === key) : undefined
}

export function formatItemStatValue(stat: Pick<ItemTextStat, "value" | "percent">, locale = "vi-VN") {
  return `${stat.value > 0 ? "+" : ""}${stat.value.toLocaleString(locale)}${stat.percent ? "%" : ""}`
}

/** Reader-facing stat groups: close stats share one filter, because readers shop for "lifesteal", not for its kinds. */
export interface ItemStatFilterDefinition {
  key: string
  vi: string
  en: string
  icon: GameplayIconName
  stats: ItemStatKey[]
}

export const ITEM_STAT_FILTERS: ItemStatFilterDefinition[] = [
  { key: "physical", vi: "Công vật lý", en: "Physical attack", icon: "sword", stats: ["physicalAttack"] },
  { key: "magic", vi: "Công phép", en: "Magic attack", icon: "orb", stats: ["magicAttack"] },
  { key: "attack-speed", vi: "Tốc đánh", en: "Attack speed", icon: "bolt", stats: ["attackSpeed"] },
  { key: "crit", vi: "Chí mạng", en: "Critical", icon: "crit", stats: ["criticalChance", "criticalDamage"] },
  { key: "lifesteal", vi: "Hút máu", en: "Lifesteal", icon: "vamp", stats: ["lifesteal", "magicLifesteal"] },
  { key: "pierce", vi: "Xuyên giáp", en: "Pierce", icon: "pierce", stats: ["armorPierce", "magicPierce"] },
  { key: "cooldown", vi: "Giảm hồi chiêu", en: "Cooldown", icon: "cooldown", stats: ["cooldownReduction"] },
  { key: "health", vi: "Máu", en: "HP", icon: "heart", stats: ["maxHealth", "healthRegen"] },
  { key: "armor", vi: "Giáp", en: "Armor", icon: "shield", stats: ["armor"] },
  { key: "magic-defense", vi: "Giáp phép", en: "Magic defense", icon: "runeShield", stats: ["magicDefense"] },
  { key: "movement", vi: "Tốc chạy", en: "Movement", icon: "boot", stats: ["movementSpeed"] },
  { key: "mana", vi: "Năng lượng", en: "Mana", icon: "mana", stats: ["maxMana", "manaRegen"] },
]

export function itemMatchesStatFilters(stats: Pick<ItemTextStat, "key">[], filters: readonly string[]) {
  return filters.every((filter) => {
    const definition = ITEM_STAT_FILTERS.find((candidate) => candidate.key === filter)
    return !definition || stats.some((stat) => stat.key && definition.stats.includes(stat.key))
  })
}

/** How many items each chip would leave on screen, given the chips already on. */
export function itemStatFilterCounts(statLists: Pick<ItemTextStat, "key">[][], active: readonly string[]) {
  return Object.fromEntries(
    ITEM_STAT_FILTERS.map((filter) => [
      filter.key,
      statLists.filter((stats) => itemMatchesStatFilters(stats, [...active, filter.key])).length,
    ]),
  )
}

interface StructuredStat {
  key: string
  value: number
  unit: string | null
}

/**
 * What a reader sees for one item. Stats entered as structured data win over the description; passives always come
 * from the description, after any structured effects.
 */
export function itemReaderContent(
  content: { stats?: StructuredStat[] },
  text?: {
    description?: string | null
    statLabels?: Record<string, string>
    effects?: { name: string; description: string }[]
  } | null,
): ItemTextContent {
  const parsed = parseItemDescription(text?.description)
  const stats = (content.stats ?? []).map((stat): ItemTextStat => {
    const definition = ITEM_STATS.find((candidate) => candidate.key === stat.key)
    return {
      key: definition?.key ?? null,
      label: text?.statLabels?.[stat.key] || definition?.vi || stat.key,
      value: stat.value,
      percent: stat.unit === "PERCENT" || stat.unit === "%",
      unique: false,
      note: null,
    }
  })
  return {
    stats: stats.length ? stats : parsed.stats,
    passives: [
      ...(text?.effects ?? []).map((effect) => ({
        name: effect.name || null,
        text: effect.description,
        unique: false,
      })),
      ...parsed.passives,
    ],
    notes: parsed.notes,
  }
}

/** Structured stats for the editor's "fill from description" action; labels the wiki does not know are skipped. */
export function itemStatsFromDescription(description: string | null | undefined) {
  return parseItemDescription(description).stats.flatMap((stat) =>
    stat.key ? [{ key: stat.key as string, value: stat.value, unit: stat.percent ? "PERCENT" : "POINT" }] : [],
  )
}

/**
 * Items of the same tier that give most of the same stats, closest in price first: the alternatives a reader weighs
 * against the item they are looking at.
 */
export function similarItems<T extends { id: string; content: { tier: number | null; price: number | null } }>(
  entry: T,
  candidates: readonly T[],
  statsOf: (item: T) => Pick<ItemTextStat, "key">[],
  limit = 4,
) {
  const keys = new Set(statsOf(entry).flatMap((stat) => (stat.key ? [stat.key] : [])))
  if (!keys.size) return []
  const required = Math.min(2, keys.size)
  return candidates
    .flatMap((item) => {
      if (item.id === entry.id || item.content.tier !== entry.content.tier) return []
      const shared = new Set(statsOf(item).flatMap((stat) => (stat.key && keys.has(stat.key) ? [stat.key] : []))).size
      return shared >= required ? [{ item, shared }] : []
    })
    .sort(
      (a, b) =>
        b.shared - a.shared ||
        Math.abs((a.item.content.price ?? 0) - (entry.content.price ?? 0)) -
          Math.abs((b.item.content.price ?? 0) - (entry.content.price ?? 0)),
    )
    .slice(0, limit)
    .map(({ item }) => item)
}
