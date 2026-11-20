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
  | "adaptiveAttack"
  | "attackRange"

export interface ItemStatDefinition {
  key: ItemStatKey
  /** The code the backend stores, shared with arcana (platform CatalogStats, ADR-033). */
  code: string
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
    code: "physical-attack",
    vi: "Công vật lý",
    en: "Attack Damage",
    icon: "sword",
    spellings: ["cong vat ly", "attack damage"],
  },
  {
    key: "magicAttack",
    code: "magic-attack",
    vi: "Công phép",
    en: "Ability Power",
    icon: "orb",
    spellings: ["cong phep", "ability power"],
  },
  {
    key: "maxHealth",
    code: "max-health",
    vi: "Máu tối đa",
    en: "Max HP",
    icon: "heart",
    spellings: ["mau toi da", "mau", "max hp", "hp"],
  },
  { key: "armor", code: "armor", vi: "Giáp", en: "Armor", icon: "shield", spellings: ["giap", "armor"] },
  {
    key: "magicDefense",
    code: "magic-defense",
    vi: "Giáp phép",
    en: "Magic Defense",
    icon: "runeShield",
    spellings: ["giap phep", "magic defense"],
  },
  {
    key: "attackSpeed",
    code: "attack-speed",
    vi: "Tốc đánh",
    en: "Attack Speed",
    icon: "bolt",
    spellings: ["toc danh", "toc dang", "attack speed"],
  },
  {
    key: "movementSpeed",
    code: "movement-speed",
    vi: "Tốc chạy",
    en: "Movement Speed",
    icon: "boot",
    spellings: ["toc chay", "movement speed"],
  },
  {
    key: "cooldownReduction",
    code: "cooldown-reduction",
    vi: "Giảm hồi chiêu",
    en: "Cooldown Speed",
    icon: "cooldown",
    spellings: ["giam hoi chieu", "cooldown speed"],
  },
  {
    key: "criticalChance",
    code: "critical-chance",
    vi: "Tỷ lệ chí mạng",
    en: "Critical Chance",
    icon: "crit",
    spellings: ["ty le chi mang", "critical chance"],
  },
  {
    key: "criticalDamage",
    code: "critical-damage",
    vi: "Sát thương chí mạng",
    en: "Critical Damage",
    icon: "critDamage",
    spellings: ["sat thuong chi mang", "critical damage"],
  },
  {
    key: "lifesteal",
    code: "physical-lifesteal",
    vi: "Hút máu",
    en: "Life Steal",
    icon: "vamp",
    spellings: ["hut mau", "life steal"],
  },
  {
    key: "magicLifesteal",
    code: "magic-lifesteal",
    vi: "Hút máu phép",
    en: "Magic Life Steal",
    icon: "vamp",
    spellings: ["hut mau phep", "magic life steal"],
  },
  {
    key: "armorPierce",
    code: "armor-penetration",
    vi: "Xuyên giáp",
    en: "Armor Pierce",
    icon: "pierce",
    spellings: ["xuyen giap", "armor pierce"],
  },
  {
    key: "magicPierce",
    code: "magic-penetration",
    vi: "Xuyên giáp phép",
    en: "Magic Pierce",
    icon: "pierce",
    spellings: ["xuyen giap phep", "magic pierce"],
  },
  {
    key: "healthRegen",
    code: "health-regen-per-five-seconds",
    vi: "Hồi máu/5s",
    en: "HP/5s",
    icon: "heart",
    spellings: ["hoi mau/5s", "hp/5s"],
  },
  {
    key: "manaRegen",
    code: "mana-regen-per-five-seconds",
    vi: "Hồi năng lượng/5s",
    en: "Mana/5s",
    icon: "mana",
    spellings: ["hoi nang luong/5s", "mana/5s"],
  },
  {
    key: "maxMana",
    code: "max-mana",
    vi: "Năng lượng tối đa",
    en: "Max Mana",
    icon: "mana",
    spellings: ["nang luong toi da", "nang luong", "max mana", "mana"],
  },
  {
    key: "tenacity",
    code: "tenacity",
    vi: "Kháng hiệu ứng",
    en: "Resistance",
    icon: "barrier",
    spellings: ["khang hieu ung", "resistance"],
  },
  {
    key: "adaptiveAttack",
    code: "adaptive-attack",
    vi: "Thuộc tính chủ đạo",
    en: "Adaptive Force",
    icon: "sword",
    spellings: ["thuoc tinh chu dao", "adaptive force"],
  },
  {
    key: "attackRange",
    code: "attack-range",
    vi: "Tầm đánh",
    en: "Attack Range",
    icon: "pierce",
    spellings: ["tam danh", "attack range"],
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
  /** The gameplay entered for this effect, when there is any. */
  gameplay?: ItemEffectGameplay
  /** The stats this effect grants, read from its gameplay. */
  grants?: ItemGrantedStat[]
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

/**
 * `locale` only chooses the language of the stat names; the text is read the same way in both. With `effectStats`
 * off, a passive that grants a stat stays a passive: an item with structured gameplay lists it among its effects, with
 * the stat as its grant (ADR-033), and only the "+N" lines are fixed stats.
 */
export function parseItemDescription(
  description: string | null | undefined,
  locale = "vi-VN",
  { effectStats = true }: { effectStats?: boolean } = {},
): ItemTextContent {
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
    if (stat && (effectStats || !stat.unique)) {
      content.stats.push(stat)
      continue
    }
    const passive = passiveFrom(line)
    const granted = effectStats ? grantedStat(passive, english) : null
    if (granted) content.stats.push(granted)
    else content.passives.push(passive)
  }
  return content
}

/** The figures a reader looks for in an effect, read from its text as the game writes them. */
export interface ItemEffectFacts {
  /** The cooldown as written, such as "0.3" or "75", in seconds. */
  cooldownSeconds: string | null
  /** How many times the effect stacks at most. */
  maxStacks: number | null
}

const COOLDOWN_PATTERNS = [
  /h[oồ]i\s+chi[eê]u\s*:?\s*(\d+(?:[.,]\d+)?)\s*gi[aâ]y/i,
  /(\d+(?:[.,]\d+)?)\s*gi[aâ]y\s+h[oồ]i\s+chi[eê]u/i,
  /cooldown\s*:?\s*(\d+(?:\.\d+)?)\s*s(?:econds?)?\b/i,
  /(\d+(?:\.\d+)?)\s*-?\s*seconds?\s+cooldown/i,
]
const STACK_PATTERNS = [
  /c[oộ]ng\s+d[oồ]n\s+(?:l[eê]n\s+)?(?:đ[eế]n\s+|t[oố]i\s+đa\s+)?(\d+)\s+l[aầ]n/i,
  /stacks?\s+up\s+to\s+(\d+)\s+times/i,
]

/**
 * Cooldown and stacks of an effect, whichever way the text words them: the cooldown before or after its seconds, in
 * brackets or not, and "stacks up to N times", in Vietnamese and in English. The tests list the wordings.
 */
export function itemEffectFacts(text: string): ItemEffectFacts {
  const cooldown = COOLDOWN_PATTERNS.map((pattern) => pattern.exec(text)).find(Boolean)
  const stacks = STACK_PATTERNS.map((pattern) => pattern.exec(text)).find(Boolean)
  return {
    cooldownSeconds: cooldown ? cooldown[1].replace(",", ".") : null,
    maxStacks: stacks ? Number(stacks[1]) : null,
  }
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

/**
 * The stats a card shows: the fixed stats, then each stat an effect grants as a plain amount, such as the movement
 * speed of a boots passive. A grant that grows, stacks, scales, lasts a few seconds or needs an active is left to the detail.
 */
export function itemCardStats(reading: Pick<ItemReaderContent, "stats" | "granted">): ItemTextStat[] {
  const plain = reading.granted.flatMap((grant): ItemTextStat[] =>
    grant.value !== null &&
    grant.maxValue === null &&
    !grant.growth &&
    !grant.scalings.length &&
    grant.durationSeconds === null &&
    !grant.active
      ? [
          {
            key: grant.key,
            label: grant.label,
            value: grant.value,
            percent: grant.percent,
            unique: grant.unique,
            note: grant.effect,
          },
        ]
      : [],
  )
  return [...reading.stats, ...plain]
}

/** The stats an item answers the filters with: its fixed stats and those its effects grant. */
export function itemFilterStats(reading: Pick<ItemReaderContent, "stats" | "granted">): Pick<ItemTextStat, "key">[] {
  return [...reading.stats, ...reading.granted]
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

export type ItemScalingSource =
  "MAX_HEALTH" | "BONUS_HEALTH" | "PHYSICAL_ATTACK" | "BONUS_PHYSICAL_ATTACK" | "MAGIC_ATTACK" | "HERO_LEVEL"

/** A stat an effect grants, as the backend stores it (ADR-033). */
export interface ItemStatGrantData {
  stat: string
  value?: number | null
  maxValue?: number | null
  unit?: string | null
  growth?: "LEVEL" | "STACK" | null
  scalings?: { source: ItemScalingSource; value: number; unit?: string | null }[]
  cap?: number | null
  durationSeconds?: number | null
  target?: "SELF" | "TEAM" | null
}

/** The gameplay of one effect, in the order the description writes the effects (ADR-033). */
export interface ItemEffectGameplay {
  key: string
  activation?: "PASSIVE" | "ACTIVE" | null
  unique?: boolean
  cooldownSeconds?: number | null
  maxStacks?: number | null
  grants?: ItemStatGrantData[]
}

/** A stat an effect grants, ready to show next to the item's fixed stats. */
export interface ItemGrantedStat {
  key: ItemStatKey | null
  label: string
  value: number | null
  maxValue: number | null
  percent: boolean
  growth: "LEVEL" | "STACK" | null
  maxStacks: number | null
  scalings: { source: ItemScalingSource; label: string; value: number; percent: boolean }[]
  cap: number | null
  durationSeconds: number | null
  /** Nearby allies get it too. */
  team: boolean
  /** The name of the effect that grants it, as the description of the reader's language writes it. */
  effect: string | null
  /** Granted while an active is in use rather than always. */
  active: boolean
  /** From a unique effect: a second item with it adds nothing. */
  unique: boolean
}

export interface ItemReaderContent extends ItemTextContent {
  /** Stats the effects grant, apart from the fixed stats; they answer the stat filters too. */
  granted: ItemGrantedStat[]
}

/**
 * What a reader sees for one item. Stats entered as structured data win over the description; passives always come
 * from the description, after any structured effects, and carry the gameplay entered for them.
 */
export function itemReaderContent(
  content: { stats?: StructuredStat[]; effects?: ItemEffectGameplay[] },
  text?: {
    description?: string | null
    statLabels?: Record<string, string>
    effects?: { name: string; description: string }[]
  } | null,
  locale = "vi-VN",
): ItemReaderContent {
  const english = locale.startsWith("en")
  // Once an item has structured gameplay, its effects are the passives as written, stat passives included.
  const structured = !!content.stats?.length || !!content.effects?.length
  const parsed = parseItemDescription(text?.description, locale, { effectStats: !structured })
  const stats = (content.stats ?? []).map((stat): ItemTextStat => {
    const definition = itemStatDefinitionByCode(stat.key)
    return {
      key: definition?.key ?? null,
      label: text?.statLabels?.[stat.key] || (english ? definition?.en : definition?.vi) || stat.key,
      value: stat.value,
      percent: isPercent(stat.unit),
      // The description still says whether the stat comes from a unique passive, and with which note.
      unique: parsed.stats.find((line) => line.key && line.key === definition?.key)?.unique ?? false,
      note: parsed.stats.find((line) => line.key && line.key === definition?.key)?.note ?? null,
    }
  })
  // The gameplay of effect n belongs to the n-th effect the description writes (ADR-033). A translation that writes a
  // different number of effects is matched by the code of each effect's name instead, which the Vietnamese text gives.
  const effects = content.effects ?? []
  const byPosition = effects.length === parsed.passives.length
  const matched = parsed.passives.map((passive, index) =>
    byPosition ? effects[index] : effects.find((effect) => passive.name && effect.key === effectKey(passive.name)),
  )
  const described = parsed.passives.map((passive, index): ItemTextPassive => {
    const gameplay = matched[index]
    if (!gameplay) return passive
    return {
      ...passive,
      gameplay,
      grants: (gameplay.grants ?? []).map((grant) => grantedFrom(grant, gameplay, passive, english)),
    }
  })
  // An effect no passive of this text matches still grants its stats; they are listed without the effect's name.
  const unmatched = effects
    .filter((effect) => !matched.includes(effect))
    .flatMap((effect) => (effect.grants ?? []).map((grant) => grantedFrom(grant, effect, null, english)))
  return {
    stats: stats.length ? stats : parsed.stats,
    granted: [...described.flatMap((passive) => passive.grants ?? []), ...unmatched],
    passives: [
      ...(text?.effects ?? []).map((effect) => ({
        name: effect.name || null,
        text: effect.description,
        unique: false,
      })),
      ...described,
    ],
    notes: parsed.notes,
  }
}

function isPercent(unit: string | null | undefined) {
  return unit === "%" || unit === "PERCENT"
}

function grantedFrom(
  grant: ItemStatGrantData,
  effect: ItemEffectGameplay,
  passive: ItemTextPassive | null,
  english: boolean,
): ItemGrantedStat {
  const definition = itemStatDefinitionByCode(grant.stat)
  return {
    key: definition?.key ?? null,
    label: (definition && (english ? definition.en : definition.vi)) ?? grant.stat,
    value: grant.value ?? null,
    maxValue: grant.maxValue ?? null,
    percent: isPercent(grant.unit),
    growth: grant.growth ?? null,
    maxStacks: effect.maxStacks ?? null,
    scalings: (grant.scalings ?? []).map((scaling) => ({
      source: scaling.source,
      label: SCALING_SOURCES[scaling.source]?.[english ? "en" : "vi"] ?? scaling.source,
      value: scaling.value,
      percent: isPercent(scaling.unit),
    })),
    cap: grant.cap ?? null,
    durationSeconds: grant.durationSeconds ?? null,
    team: grant.target === "TEAM",
    effect: passive?.name ?? null,
    active: effect.activation === "ACTIVE",
    unique: effect.unique ?? passive?.unique ?? false,
  }
}

/** The code of an effect name, as the backend keys effects: accent-free, lowercase, words joined by dashes. */
export function effectKey(name: string) {
  return foldSearchText(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function itemStatDefinitionByCode(code: string) {
  return ITEM_STATS.find((stat) => stat.code === code || stat.key === code)
}

/** The stats a scaling part may follow, as the descriptions name them. */
const SCALING_SOURCES: Record<ItemScalingSource, { vi: string; en: string }> = {
  MAX_HEALTH: { vi: "máu tối đa", en: "max HP" },
  BONUS_HEALTH: { vi: "máu thêm", en: "bonus HP" },
  PHYSICAL_ATTACK: { vi: "công vật lý", en: "attack damage" },
  BONUS_PHYSICAL_ATTACK: { vi: "công vật lý thêm", en: "bonus attack damage" },
  MAGIC_ATTACK: { vi: "công phép", en: "ability power" },
  HERO_LEVEL: { vi: "mỗi cấp tướng", en: "per hero level" },
}

/**
 * A granted stat's amount as the game writes it, "+32–60" or "+10%", whatever the reader's locale; null when the grant
 * is only a scaling.
 */
export function formatItemGrantAmount(grant: Pick<ItemGrantedStat, "value" | "maxValue" | "percent">) {
  if (grant.value === null) return null
  const range = grant.maxValue !== null && grant.maxValue !== grant.value ? `–${formatGameNumber(grant.maxValue)}` : ""
  return `+${formatGameNumber(grant.value)}${range}${grant.percent ? "%" : ""}`
}

/** What a grant scales with, as the game writes it in brackets: 3% of bonus health, 40 per hero level. */
export function itemGrantScalings(grant: Pick<ItemGrantedStat, "scalings">) {
  return grant.scalings.map(
    (scaling) => `+${formatGameNumber(scaling.value)}${scaling.percent ? "%" : ""} ${scaling.label}`,
  )
}

/**
 * The conditions of a granted stat, in reading order: how it grows, its cap, how long it lasts and who gets it. Words
 * follow frontend/docs/QUY-UOC-VIET.md.
 */
export function itemGrantConditions(grant: ItemGrantedStat, locale = "vi-VN") {
  const english = locale.startsWith("en")
  const unit = grant.percent ? "%" : ""
  return [
    grant.growth === "LEVEL" ? (english ? "grows with level" : "tăng theo cấp") : null,
    grant.growth === "STACK"
      ? english
        ? `per stack${grant.maxStacks ? `, up to ${grant.maxStacks} stacks` : ""}`
        : `mỗi lần cộng dồn${grant.maxStacks ? `, tối đa ${grant.maxStacks} lần` : ""}`
      : null,
    grant.cap !== null
      ? english
        ? `max ${formatGameNumber(grant.cap)}${unit}`
        : `tối đa ${formatGameNumber(grant.cap)}${unit}`
      : null,
    grant.durationSeconds !== null
      ? english
        ? `for ${formatGameNumber(grant.durationSeconds)} seconds`
        : `trong ${formatGameNumber(grant.durationSeconds)} giây`
      : null,
    grant.team ? (english ? "also nearby allies" : "cả đồng đội lân cận") : null,
  ].filter((part): part is string => !!part)
}

/**
 * The effects of a description as the editor's "fill from description" action enters them: one per effect the text
 * writes, keyed by its name, with how it is used, its cooldown and stacks, and the stat of a passive written as "+N
 * stat". Stats granted in prose, such as a magic pierce of 32–60, are left for the editor to enter.
 */
export function itemEffectsFromDescription(description: string | null | undefined): ItemEffectGameplay[] {
  const used = new Set<string>()
  return parseItemDescription(description, "vi-VN", { effectStats: false }).passives.map((passive, index) => {
    const facts = itemEffectFacts(passive.text)
    const grants = passive.text.startsWith("+")
      ? parseItemDescription(passive.text).stats.flatMap((stat): ItemStatGrantData[] => {
          const definition = itemStatDefinition(stat.key)
          return definition ? [{ stat: definition.code, value: stat.value, unit: stat.percent ? "%" : null }] : []
        })
      : []
    const named = passive.name ?? (grants[0] && itemStatDefinitionByCode(grants[0].stat)?.vi)
    let key = (named && effectKey(named)) || `hieu-ung-${index + 1}`
    if (used.has(key)) key = `${key}-${index + 1}`
    used.add(key)
    return {
      key,
      activation: passive.active ? "ACTIVE" : "PASSIVE",
      unique: passive.unique,
      cooldownSeconds: facts.cooldownSeconds === null ? null : Number(facts.cooldownSeconds),
      maxStacks: facts.maxStacks,
      grants,
    }
  })
}

/**
 * Structured stats for the editor's "fill from description" action, in the codes the backend stores; labels the wiki
 * does not know are skipped.
 */
export function itemStatsFromDescription(description: string | null | undefined) {
  return parseItemDescription(description, "vi-VN", { effectStats: false }).stats.flatMap((stat) => {
    const definition = itemStatDefinition(stat.key)
    return definition ? [{ key: definition.code, value: stat.value, unit: stat.percent ? "%" : null }] : []
  })
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
