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
  /** Used on demand by the player rather than always on. */
  active?: boolean
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
const ACTIVE = /k[ií]ch\s+ho[aạ]t\s+(?:duy\s+nh[aấ]t|ch[uủ]\s+đ[oộ]ng)/i

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

/** Removes a marker such as "unique passive" from the line, together with the dash or colon that joined it. */
function withoutMarker(line: string, marker: RegExp) {
  return line
    .replace(new RegExp(`\\s*[–—-]?\\s*${marker.source}\\s*[.:–—-]?\\s*`, "gi"), " ")
    .replace(/\s+/g, " ")
    .trim()
}

function passiveFrom(line: string): ItemTextPassive {
  const unique = UNIQUE.test(line)
  const active = ACTIVE.test(line)
  let text = withoutMarker(withoutMarker(line, UNIQUE), ACTIVE)
    // A bare "passive" prefix says nothing the section heading does not; the real name, if any, follows it.
    .replace(/^n[oộ]i\s+t[aạ]i\s*[:–—-]\s*/i, "")
  const flags = { unique, ...(active ? { active } : {}) }

  // Some entries put the name last, in angle brackets.
  const tagged = /^(.*?)\s*<([^<>]{2,40})>\s*\.?$/s.exec(text)
  if (tagged) return { name: tagged[2].trim(), text: tagged[1].trim(), ...flags }

  text = text.trim()
  const label = /^([^:.,;()\d]{2,40}?)(?:\s*:\s*|\s+[–—-]\s+)(.+)$/s.exec(text)
  if (label && label[1].trim().split(/\s+/).length <= 5) {
    return { name: label[1].trim(), text: label[2].trim(), ...flags }
  }
  return { name: null, text, ...flags }
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
 * What a passive does, recognised from its wording so that items with differently named passives can still be matched.
 * Patterns run on accent-free, lowercase text and only list effects specific enough to say something about the item.
 */
export const ITEM_EFFECTS: { key: string; vi: string; en: string; pattern: RegExp }[] = [
  {
    key: "anti-heal",
    vi: "Giảm hồi máu",
    en: "Healing reduction",
    pattern: /giam (?:\d+% )?(?:hieu (?:ung|qua) )?hoi mau/,
  },
  {
    key: "heal",
    vi: "Hồi máu",
    en: "Healing",
    pattern: /(?<!giam (?:\d+% )?(?:hieu (?:ung|qua) )?)hoi (?:mau|phuc)|hoi \d+[^.;]{0,20} mau/,
  },
  { key: "shield", vi: "Lá chắn", en: "Shield", pattern: /la chan/ },
  { key: "slow", vi: "Làm chậm", en: "Slow", pattern: /lam cham/ },
  { key: "burn", vi: "Thiêu đốt", en: "Burn", pattern: /thieu dot/ },
  { key: "revive", vi: "Hồi sinh", en: "Revive", pattern: /hoi sinh|phuc sinh|song lai/ },
  {
    key: "invulnerable",
    vi: "Miễn thương",
    en: "Damage immunity",
    pattern: /mien thuong|mien nhiem sat thuong|vo dich|bat kha xam pham/,
  },
  { key: "cleanse", vi: "Giải khống chế", en: "Cleanse", pattern: /mien khong|giai khong|hoa giai khong che/ },
  { key: "reflect", vi: "Phản sát thương", en: "Damage reflection", pattern: /phan (?:sat thuong|lai|don)/ },
  { key: "true-damage", vi: "Sát thương chuẩn", en: "True damage", pattern: /sat thuong chuan/ },
  {
    key: "percent-health",
    vi: "Sát thương theo % máu",
    en: "Damage based on health",
    pattern: /tuong duong[^.;]{0,10}\d+% mau|\d+% mau hien tai|gay \d+% mau toi da thanh sat thuong/,
  },
  {
    key: "on-hit",
    vi: "Đánh thường gây thêm sát thương",
    en: "On-hit damage",
    pattern: /danh thuong[^.;]{0,30}gay them/,
  },
  { key: "shred", vi: "Giảm giáp mục tiêu", en: "Armor reduction", pattern: /giam [^.;]{0,16}giap|pha giap/ },
  {
    key: "attack-speed-down",
    vi: "Giảm tốc đánh địch",
    en: "Attack speed reduction",
    pattern: /giam (?:\d+% )?toc danh/,
  },
  { key: "stealth", vi: "Chống tàng hình", en: "Stealth detection", pattern: /tang hinh/ },
]

const GENERIC_PASSIVE_NAMES = new Set(["noi tai", "kich hoat", "chu dong"])

/** Everything used to tell whether two items play alike. */
export interface ItemProfile {
  stats: ItemStatKey[]
  /** Named passives, keyed without accents: the same name means the same mechanic across items. */
  passives: Map<string, string>
  effects: string[]
  active: boolean
  summary: string
  category: string | null
  damage: "physical" | "magic" | null
}

export function itemProfile(
  reading: ItemTextContent,
  { summary, category = null }: { summary?: string | null; category?: string | null } = {},
): ItemProfile {
  const stats = [...new Set(reading.stats.flatMap((stat) => (stat.key ? [stat.key] : [])))]
  const hasPhysical = stats.includes("physicalAttack")
  const hasMagic = stats.includes("magicAttack")
  const passives = new Map<string, string>()
  for (const { name } of reading.passives) {
    const key = name && folded(name)
    if (key && !GENERIC_PASSIVE_NAMES.has(key)) passives.set(key, name)
  }
  const text = folded(
    [summary ?? "", ...reading.passives.map((passive) => `${passive.name ?? ""} ${passive.text}`)].join(". "),
  )
  return {
    stats,
    passives,
    effects: ITEM_EFFECTS.filter((effect) => effect.pattern.test(text)).map((effect) => effect.key),
    active: reading.passives.some((passive) => passive.active),
    summary: folded(summary ?? ""),
    category,
    damage: hasPhysical === hasMagic ? null : hasPhysical ? "physical" : "magic",
  }
}

export interface ItemSimilarity<T> {
  item: T
  /** Why the item was picked, strongest reason first. */
  reasons: { vi: string; en: string }[]
}

const SIMILAR_MINIMUM_SCORE = 4
const MISMATCH_PENALTY = 4
/** Only one item of these can be carried, by the role that needs it, so they rarely replace an ordinary item. */
const ROLE_LIMITED_CATEGORIES = new Set(["phu-tro", "di-rung"])
const isRoleLimited = (profile: ItemProfile) => ROLE_LIMITED_CATEGORIES.has(profile.category ?? "")

/**
 * Items of the same tier that play alike, the alternatives a reader weighs against the one they are looking at.
 * What an item does counts for more than the stats it gives: the same named passive or written purpose is the strongest
 * sign, then a passive with the same effect, then the same shop category, then each shared stat. A passive that a large
 * share of the catalog carries says little, so it counts like a stat. An item for the other damage type, or a role item
 * set against an ordinary one, is rarely a real alternative and needs a strong reason to appear. Ties go to the closest
 * price.
 */
export function similarItems<T extends { id: string; content: { tier: number | null; price: number | null } }>(
  entry: T,
  candidates: readonly T[],
  profileOf: (item: T) => ItemProfile,
  limit = 4,
): ItemSimilarity<T>[] {
  const own = profileOf(entry)
  const others = candidates.map((item) => ({ item, profile: profileOf(item) }))
  const carriers = new Map<string, number>()
  for (const { profile } of others)
    for (const key of profile.passives.keys()) carriers.set(key, (carriers.get(key) ?? 0) + 1)
  const isCommon = (key: string) => (carriers.get(key) ?? 0) > Math.max(12, others.length * 0.15)

  return others
    .flatMap(({ item, profile }) => {
      if (item.id === entry.id || item.content.tier !== entry.content.tier) return []
      const passives = [...own.passives].filter(([key]) => profile.passives.has(key))
      const distinctive = passives.filter(([key]) => !isCommon(key)).map(([, name]) => name)
      const effects = ITEM_EFFECTS.filter(
        (effect) => own.effects.includes(effect.key) && profile.effects.includes(effect.key),
      )
      const stats = own.stats.filter((stat) => profile.stats.includes(stat))
      const score =
        distinctive.length * 4 +
        (passives.length - distinctive.length) +
        (own.summary && own.summary === profile.summary ? 4 : 0) +
        effects.length * 3 +
        (own.category && own.category === profile.category ? 2 : 0) +
        (own.active && profile.active ? 1 : 0) +
        stats.length -
        (own.damage && profile.damage && own.damage !== profile.damage ? MISMATCH_PENALTY : 0) -
        (isRoleLimited(own) !== isRoleLimited(profile) ? MISMATCH_PENALTY : 0)
      if (score < SIMILAR_MINIMUM_SCORE) return []
      const reasons = [
        ...distinctive.map((name) => ({ vi: name, en: name })),
        ...effects.map(({ vi, en }) => ({ vi, en })),
        ...stats.flatMap((stat) => {
          const definition = itemStatDefinition(stat)
          return definition ? [{ vi: definition.vi, en: definition.en }] : []
        }),
      ]
      return [{ item, score, reasons }]
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        Math.abs((a.item.content.price ?? 0) - (entry.content.price ?? 0)) -
          Math.abs((b.item.content.price ?? 0) - (entry.content.price ?? 0)),
    )
    .slice(0, limit)
    .map(({ item, reasons }) => ({ item, reasons }))
}
