import type { GameplayIconName } from "../components/gameplay-icons"
import { formatGameNumber } from "@aov/ui/lib/game-number"
import { foldSearchText } from "@aov/ui/lib/search-text"

/**
 * Item entries keep their stats and effects as free text in the description: a "+60 <stat>" line for each stat, then
 * one line per effect. The house format (frontend/docs/QUY-UOC-VIET.md) puts the label first, "<unique passive label> –
 * <name>: <effect>" or "<active label> – <name>: <effect>"; entries imported earlier put it last or leave it out, and
 * both read the same here. This turns that text into something a reader can scan and filter, without changing what is
 * stored. Lines the parser does not recognise stay as plain passive text, so nothing is ever lost.
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
  /**
   * Accent-free, lowercase spellings seen in the data, including recurring typos, followed by the English name the
   * `en-US` descriptions use.
   */
  spellings: string[]
}

/** English names follow the game's own wording (docs/THUAT-NGU-VIET-ANH.md). */
export const ITEM_STATS: ItemStatDefinition[] = [
  {
    key: "physicalAttack",
    vi: "Công vật lý",
    en: "Attack Damage",
    icon: "sword",
    spellings: ["cong vat ly", "attack damage"],
  },
  { key: "magicAttack", vi: "Công phép", en: "Ability Power", icon: "orb", spellings: ["cong phep", "ability power"] },
  { key: "maxHealth", vi: "Máu tối đa", en: "Max HP", icon: "heart", spellings: ["mau toi da", "mau", "max hp", "hp"] },
  { key: "armor", vi: "Giáp", en: "Armor", icon: "shield", spellings: ["giap", "armor"] },
  {
    key: "magicDefense",
    vi: "Giáp phép",
    en: "Magic Defense",
    icon: "runeShield",
    spellings: ["giap phep", "magic defense"],
  },
  {
    key: "attackSpeed",
    vi: "Tốc đánh",
    en: "Attack Speed",
    icon: "bolt",
    spellings: ["toc danh", "toc dang", "attack speed"],
  },
  {
    key: "movementSpeed",
    vi: "Tốc chạy",
    en: "Movement Speed",
    icon: "boot",
    spellings: ["toc chay", "movement speed"],
  },
  {
    key: "cooldownReduction",
    vi: "Giảm hồi chiêu",
    en: "Cooldown Speed",
    icon: "cooldown",
    spellings: ["giam hoi chieu", "cooldown speed"],
  },
  {
    key: "criticalChance",
    vi: "Tỷ lệ chí mạng",
    en: "Critical Chance",
    icon: "crit",
    spellings: ["ty le chi mang", "critical chance"],
  },
  {
    key: "criticalDamage",
    vi: "Sát thương chí mạng",
    en: "Critical Damage",
    icon: "critDamage",
    spellings: ["sat thuong chi mang", "critical damage"],
  },
  { key: "lifesteal", vi: "Hút máu", en: "Life Steal", icon: "vamp", spellings: ["hut mau", "life steal"] },
  {
    key: "magicLifesteal",
    vi: "Hút máu phép",
    en: "Magic Life Steal",
    icon: "vamp",
    spellings: ["hut mau phep", "magic life steal"],
  },
  {
    key: "armorPierce",
    vi: "Xuyên giáp",
    en: "Armor Pierce",
    icon: "pierce",
    spellings: ["xuyen giap", "armor pierce"],
  },
  {
    key: "magicPierce",
    vi: "Xuyên giáp phép",
    en: "Magic Pierce",
    icon: "pierce",
    spellings: ["xuyen giap phep", "magic pierce"],
  },
  { key: "healthRegen", vi: "Hồi máu/5s", en: "HP/5s", icon: "heart", spellings: ["hoi mau/5s", "hp/5s"] },
  {
    key: "manaRegen",
    vi: "Hồi năng lượng/5s",
    en: "Mana/5s",
    icon: "mana",
    spellings: ["hoi nang luong/5s", "mana/5s"],
  },
  {
    key: "maxMana",
    vi: "Năng lượng tối đa",
    en: "Max Mana",
    icon: "mana",
    spellings: ["nang luong toi da", "nang luong", "max mana", "mana"],
  },
  {
    key: "tenacity",
    vi: "Kháng hiệu ứng",
    en: "Resistance",
    icon: "barrier",
    spellings: ["khang hieu ung", "resistance"],
  },
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
  return foldSearchText(value).replace(/\s+/g, " ").trim()
}

// Each marker is matched as the Vietnamese data writes it and as the English descriptions do.
const UNIQUE = /n[oộ]i\s+t[aạ]i\s+duy\s+nh[aấ]t|unique\s+passive/i
const STAT_LINE = /^["'“”\s]*(\+)?\s*(\d[\d.,]*)\s*(%?)\s+(.+)$/
const SEPARATOR = /\s+[–—-]\s+/
const UNIQUE_ACTIVE = /k[ií]ch\s+ho[aạ]t\s+duy\s+nh[aấ]t|unique\s+active/i
/**
 * The active label words ("kich hoat" with or without "chu dong", "active" with or without "ability") also occur inside
 * ordinary sentences, so they only count as the label where a label stands: opening the line before a dash or colon,
 * or closing it after a dash.
 */
const ACTIVE_WORD = String.raw`(?:k[ií]ch\s+ho[aạ]t(?:\s+ch[uủ]\s+đ[oộ]ng)?|active(?:\s+ability)?)`
const ACTIVE_LABEL = new RegExp(String.raw`^${ACTIVE_WORD}\s*[:–—-]\s*|\s+[–—-]\s*${ACTIVE_WORD}\s*\.?$`, "i")

function numberFrom(text: string) {
  if (/^\d{1,3}(\.\d{3})+$/.test(text)) return Number(text.replaceAll(".", ""))
  return Number(text.replace(",", "."))
}

function statFrom(line: string, english: boolean): ItemTextStat | null {
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
    label: (definition && (english ? definition.en : definition.vi)) ?? base,
    value,
    percent: percent === "%",
    unique,
    note: note || null,
  }
}

/** Removes a marker such as "unique passive" from the line, together with the dash or colon that joined it. */
function withoutMarker(line: string, marker: RegExp) {
  return line
    .replace(new RegExp(`\\s*[–—-]?\\s*(?:${marker.source})\\s*[.:–—-]?\\s*`, "gi"), " ")
    .replace(/\s+/g, " ")
    .trim()
}

function passiveFrom(line: string): ItemTextPassive {
  const unique = UNIQUE.test(line)
  const active = UNIQUE_ACTIVE.test(line) || ACTIVE_LABEL.test(line)
  let text = withoutMarker(withoutMarker(line, UNIQUE), UNIQUE_ACTIVE)
    .replace(ACTIVE_LABEL, "")
    // A bare "passive" prefix says nothing the section heading does not; the real name, if any, follows it.
    .replace(/^(?:n[oộ]i\s+t[aạ]i|passive)\s*[:–—-]\s*/i, "")
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

/**
 * A passive that only grants a stat, such as "<unique passive label> – <name>: +60 <stat>", is a stat to the reader: it
 * belongs with the other numbers and answers the stat filters, wherever the label was written.
 */
function grantedStat(passive: ItemTextPassive, english: boolean): ItemTextStat | null {
  if (passive.active || !passive.text.startsWith("+")) return null
  const stat = statFrom(passive.text, english)
  if (!stat?.key) return null
  const note = [passive.name, stat.note].filter(Boolean).join(" · ")
  return { ...stat, unique: passive.unique, note: note || null }
}

/** `locale` only chooses the language of the stat names; the text is read the same way in both. */
export function parseItemDescription(description: string | null | undefined, locale = "vi-VN"): ItemTextContent {
  const english = locale.startsWith("en")
  const content: ItemTextContent = { stats: [], passives: [], notes: [] }
  for (const raw of (description ?? "").split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (/^\((?![+\d])[^)]*\)?\s*\.?$/.test(line)) {
      content.notes.push(line.replace(/^\(|\)?\s*\.?$/g, "").trim())
      continue
    }
    const stat = statFrom(line, english)
    if (stat) {
      content.stats.push(stat)
      continue
    }
    const passive = passiveFrom(line)
    const granted = grantedStat(passive, english)
    if (granted) content.stats.push(granted)
    else content.passives.push(passive)
  }
  return content
}

export function itemStatDefinition(key: ItemStatKey | null) {
  return key ? ITEM_STATS.find((stat) => stat.key === key) : undefined
}

/** A stat line's figure as the game writes it, such as "+1200" or "+0.5%", whatever the reader's locale. */
export function formatItemStatValue(stat: Pick<ItemTextStat, "value" | "percent">) {
  return `${stat.value > 0 ? "+" : ""}${formatGameNumber(stat.value)}${stat.percent ? "%" : ""}`
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
  { key: "physical", vi: "Công vật lý", en: "Attack Damage", icon: "sword", stats: ["physicalAttack"] },
  { key: "magic", vi: "Công phép", en: "Ability Power", icon: "orb", stats: ["magicAttack"] },
  { key: "attack-speed", vi: "Tốc đánh", en: "Attack Speed", icon: "bolt", stats: ["attackSpeed"] },
  { key: "crit", vi: "Chí mạng", en: "Critical", icon: "crit", stats: ["criticalChance", "criticalDamage"] },
  { key: "lifesteal", vi: "Hút máu", en: "Life Steal", icon: "vamp", stats: ["lifesteal", "magicLifesteal"] },
  { key: "pierce", vi: "Xuyên giáp", en: "Pierce", icon: "pierce", stats: ["armorPierce", "magicPierce"] },
  { key: "cooldown", vi: "Giảm hồi chiêu", en: "Cooldown Speed", icon: "cooldown", stats: ["cooldownReduction"] },
  { key: "health", vi: "Máu", en: "HP", icon: "heart", stats: ["maxHealth", "healthRegen"] },
  { key: "armor", vi: "Giáp", en: "Armor", icon: "shield", stats: ["armor"] },
  { key: "magic-defense", vi: "Giáp phép", en: "Magic Defense", icon: "runeShield", stats: ["magicDefense"] },
  { key: "movement", vi: "Tốc chạy", en: "Movement Speed", icon: "boot", stats: ["movementSpeed"] },
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
  locale = "vi-VN",
): ItemTextContent {
  const english = locale.startsWith("en")
  const parsed = parseItemDescription(text?.description, locale)
  const stats = (content.stats ?? []).map((stat): ItemTextStat => {
    const definition = ITEM_STATS.find((candidate) => candidate.key === stat.key)
    return {
      key: definition?.key ?? null,
      label: text?.statLabels?.[stat.key] || (english ? definition?.en : definition?.vi) || stat.key,
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
 * `pattern` reads the Vietnamese data and `english` the `en-US` descriptions, which are written to the same phrases
 * so that an item gets the same effects in both languages.
 */
export const ITEM_EFFECTS: { key: string; vi: string; en: string; pattern: RegExp; english: RegExp }[] = [
  {
    key: "anti-heal",
    vi: "Giảm hồi máu",
    en: "Healing reduction",
    pattern: /giam (?:\d+% )?(?:hieu (?:ung|qua) )?hoi mau/,
    english: /reduces? [^.;]{0,24}healing|healing reduction/,
  },
  {
    key: "heal",
    vi: "Hồi máu",
    en: "Healing",
    pattern: /(?<!giam (?:\d+% )?(?:hieu (?:ung|qua) )?)hoi (?:mau|phuc)|hoi (?:tong cong )?\d+[^.;]{0,20} mau/,
    english:
      /\bheals?\b|(?<!reduces? [^.;]{0,24})\bhealing\b(?! reduction)|restor\w* [^.;]{0,40}\bhp\b|\brecover\w*|\bregenerate\b/,
  },
  { key: "shield", vi: "Lá chắn", en: "Shield", pattern: /la chan/, english: /\bshields?\b/ },
  { key: "slow", vi: "Làm chậm", en: "Slow", pattern: /lam cham/, english: /\bslow(?:s|ed|ing)?\b/ },
  { key: "burn", vi: "Thiêu đốt", en: "Burn", pattern: /thieu dot/, english: /burn damage|burns enemies/ },
  { key: "revive", vi: "Hồi sinh", en: "Revive", pattern: /hoi sinh|phuc sinh|song lai/, english: /\breviv\w*/ },
  {
    key: "invulnerable",
    vi: "Miễn thương",
    en: "Damage immunity",
    pattern: /mien thuong|mien nhiem sat thuong|vo dich|bat kha xam pham/,
    english: /(?<!physical )damage (?:immunity|reduction)|immune to (?:fatal )?damage|\binvincib\w*|\binvulnerab\w*/,
  },
  {
    key: "cleanse",
    vi: "Giải khống chế",
    en: "Cleanse",
    pattern: /mien khong|giai khong|hoa giai khong che/,
    english: /control immunity|removes? (?:all )?control effects|\bcleanse/,
  },
  {
    key: "reflect",
    vi: "Phản sát thương",
    en: "Damage reflection",
    pattern: /phan (?:sat thuong|lai|don)/,
    english: /\breflect\w*/,
  },
  {
    key: "true-damage",
    vi: "Sát thương chuẩn",
    en: "True damage",
    pattern: /sat thuong chuan/,
    english: /true damage/,
  },
  {
    key: "percent-health",
    vi: "Sát thương theo % máu",
    en: "Damage based on health",
    pattern: /tuong duong[^.;]{0,10}\d+% mau|\d+% mau hien tai|gay \d+% mau toi da thanh sat thuong/,
    english: /equal to \(?\d+% of [^.;]{0,32}\bhp\b|\d+% of the target's current hp/,
  },
  {
    key: "on-hit",
    vi: "Đánh thường gây thêm sát thương",
    en: "On-hit damage",
    pattern: /danh thuong[^.;]{0,30}gay them/,
    english: /normal attacks?[^.;]{0,40}deals? (?:an )?extra/,
  },
  {
    key: "shred",
    vi: "Giảm giáp mục tiêu",
    en: "Armor reduction",
    pattern: /giam [^.;]{0,16}giap|pha giap/,
    english: /armor reduction|reduces? [^.;]{0,16}\barmor\b/,
  },
  {
    key: "attack-speed-down",
    vi: "Giảm tốc đánh địch",
    en: "Attack Speed reduction",
    pattern: /giam (?:\d+% )?toc danh/,
    english: /reduces? (?:the )?attack speed|attack speed reduction/,
  },
  { key: "stealth", vi: "Chống tàng hình", en: "Stealth detection", pattern: /tang hinh/, english: /\bstealth\b/ },
]

const GENERIC_PASSIVE_NAMES = new Set(["noi tai", "kich hoat", "chu dong", "passive", "active"])

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
    effects: ITEM_EFFECTS.filter((effect) => effect.pattern.test(text) || effect.english.test(text)).map(
      (effect) => effect.key,
    ),
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
