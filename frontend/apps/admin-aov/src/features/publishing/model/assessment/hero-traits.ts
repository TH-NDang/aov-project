import { HERO_TRAITS, HERO_TRAIT_GROUPS } from "@aov/ui/lib/hero-traits"
import type { Skill, Trait, TraitCode } from "../../api/types"
import { skillLabel } from "../skills/hero-skills"

/**
 * The yes/no traits of a hero (ADR-029), as the Admin names them. The machine reads them from the Vietnamese skill text
 * and the game's own skill tags as suggestions; an editor confirms each one, and only confirmed traits are saved and
 * shown to readers. The list itself is shared with the Wiki.
 */
export const TRAIT_GROUPS = HERO_TRAIT_GROUPS.map((group) => group.vi)
export type TraitGroup = string

export interface TraitInfo {
  code: TraitCode
  group: TraitGroup
  label: string
  /** The skill text rarely says it, so the editor decides from play rather than from a suggestion. */
  manual?: boolean
}

export const TRAITS: readonly TraitInfo[] = HERO_TRAITS.map((trait) => ({
  code: trait.code,
  group: HERO_TRAIT_GROUPS.find((group) => group.key === trait.group)!.vi,
  label: trait.vi,
  manual: trait.manual,
}))

const order = new Map(TRAITS.map((trait, index) => [trait.code, index]))
export const traitInfo = (code: TraitCode) => TRAITS[order.get(code) ?? 0]!
export const TRAIT_DETAIL_MAX = 300

/** A trait the skill text supports, with the skills that give it and the sentence that says so. */
export interface TraitSuggestion {
  code: TraitCode
  skillKeys: string[]
  evidence: { skillKey: string; text: string } | null
  /** A one-line detail in Vietnamese where the text gives one, such as how long crowd control lasts; else empty. */
  detail: string
}

type CrowdControl = "STUN" | "KNOCK_UP" | "SUPPRESS" | "PETRIFY" | "FREEZE" | "SLEEP" | "TAUNT" | "ROOT" | "POLYMORPH"
/** A slow is no trait of its own, but it is crowd control the game's generic control tag may stand for. */
type Control = CrowdControl | "OTHER" | "KNOCK_BACK" | "PULL" | "SILENCE" | "SLOW"

// Every keyword ends at a word boundary, so the words for an empowered basic attack never read as petrify.
const HARD_CC: { type: CrowdControl; label: string; pattern: RegExp }[] = [
  { type: "STUN", label: "choáng", pattern: /(làm |gây |bị |hiệu ứng )?choáng(?!\p{L})/u },
  { type: "KNOCK_UP", label: "hất tung", pattern: /hất (tung|văng)(?!\p{L})/u },
  { type: "SUPPRESS", label: "áp chế", pattern: /áp chế(?!\p{L})/u },
  { type: "PETRIFY", label: "hóa đá", pattern: /(?<!\p{L})hóa đá(?!\p{L})/u },
  { type: "FREEZE", label: "đóng băng", pattern: /đóng băng(?!\p{L})/u },
  { type: "SLEEP", label: "ngủ", pattern: /(khiến|làm|bị|rơi vào) (\S+ ){0,4}ngủ(?!\p{L})|ru ngủ/u },
  { type: "TAUNT", label: "khiêu khích", pattern: /khiêu khích(?!\p{L})/u },
  { type: "ROOT", label: "trói", pattern: /trói (buộc|chân)(?!\p{L})|giam cầm(?!\p{L})|bị trói(?!\p{L})/u },
  { type: "POLYMORPH", label: "biến hình", pattern: /biến (kẻ địch|mục tiêu|chúng|nạn nhân) thành/u },
]
const DISPLACE: { type: "KNOCK_BACK" | "PULL"; label: string; pattern: RegExp }[] = [
  {
    type: "KNOCK_BACK",
    label: "đẩy lùi",
    pattern:
      /đẩy lùi|đẩy (kẻ địch|mục tiêu|chúng|địch|nạn nhân)|hất (kẻ địch|mục tiêu|chúng|địch|nạn nhân)? ?(ra sau|về sau|ngược)/u,
  },
  {
    type: "PULL",
    label: "kéo",
    pattern:
      /kéo (kẻ địch|mục tiêu|chúng|địch|nạn nhân|tướng địch|những kẻ địch)|hút (kẻ địch|mục tiêu|chúng|địch|nạn nhân|những kẻ địch)|kéo về|kéo lại/u,
  },
]
const SOFT: { type: "SLOW" | "SILENCE"; pattern: RegExp }[] = [
  { type: "SLOW", pattern: /làm chậm|giảm (\d+(?:\.\d+)?%? )?tốc chạy/u },
  { type: "SILENCE", pattern: /câm lặng/u },
]
// The game's own tags name the effect even when the text words it differently.
const TAG_CONTROL: Record<string, Control> = {
  Choáng: "STUN",
  "Hất tung": "KNOCK_UP",
  "Áp chế": "SUPPRESS",
  "Đóng băng": "FREEZE",
  "Kh.khích": "TAUNT",
  "Trói chân": "ROOT",
  "Đẩy lùi": "KNOCK_BACK",
  "Làm chậm": "SLOW",
  "Câm lặng": "SILENCE",
}
const CONTROL_LABEL: Record<Control, string> = {
  STUN: "choáng",
  KNOCK_UP: "hất tung",
  SUPPRESS: "áp chế",
  PETRIFY: "hóa đá",
  FREEZE: "đóng băng",
  SLEEP: "ngủ",
  TAUNT: "khiêu khích",
  ROOT: "trói",
  POLYMORPH: "biến hình",
  OTHER: "khống chế",
  KNOCK_BACK: "đẩy lùi",
  PULL: "kéo",
  SILENCE: "câm lặng",
  SLOW: "làm chậm",
}
// Crowd control counts as area only when the sentence names several victims, not when it merely states a range.
const AREA_CC =
  /(những|các|tất cả) (kẻ địch|nạn nhân|mục tiêu|tướng địch|kẻ|tướng)|(kẻ địch|tướng địch|địch|mục tiêu|nạn nhân) (trong phạm vi|xung quanh|lân cận|trúng chiêu|bên trong|trong vùng)|xung quanh|lân cận|(hất tung|đẩy lùi|làm chậm|làm choáng) chúng/u
const ALLY = /đồng minh|đồng đội/u
const DASH_WORD =
  /lướt|lao (tới|đến|về|lên|vào|ra|thẳng)|nhảy (tới|đến|về|lên|xổ|vào|ra|vồ|lùi)|dịch chuyển|tốc biến|bay (tới|đến|lên|về)|phóng (tới|đến|về|lên)|xông (tới|đến|vào)|húc (tới|đến|về)|biến lại gần|áp sát|lộn|độn thổ|vọt/u
const CC_IMMUNE = /miễn khống|miễn nhiễm (?:\S+ ){0,6}khống chế|không thể bị khống chế/u
const CLEANSE = /giải (?:trừ )?(?:mọi |các |tất cả )?(?:trạng thái |hiệu ứng )?(?:khống|tiêu cực|bất lợi|xấu)/u
const UNTARGETABLE = /không (thể )?bị (chọn|khóa) (làm )?mục tiêu/u
const STEALTH = /tàng hình|ngụy trang|ẩn thân/u
// The bare word for recovery is often the enemy's healing being cut, so it only helps find the sentence of a heal.
const HEAL = /hồi (\S+ ){0,8}máu/u
const HEAL_SENTENCE = /hồi (\S+ ){0,8}máu|hồi phục/u
const RATIO =
  /(\d+(?:\.\d+)?)\s*%\s*(công vật lý cộng thêm|công vật lý thêm|công vật lý|công vl|công phép thêm|công phép cộng thêm|công phép|máu tối đa(?: của)?(?: bản thân| mục tiêu)?|máu thêm|máu đã mất|máu hiện tại|giáp)/gu
const BASE = /(?:^|[\s(])(\d+(?:\.\d+)?)(?=\s*(?:\(|\+|sát thương|$))(?!\s*%)/gu
const REDUCTION = /miễn thương|giảm (\d+(?:\.\d+)?%? )?sát thương (phải |gánh )?chịu/u
const REVIVE = /vô địch|bất tử|hồi sinh|miễn tử|không thể bị hạ/u
const GLOBAL = /truyền tống|trên (toàn )?bản đồ|toàn bản đồ/u
const TERRAIN = /xuyên (qua )?(địa hình|tường)|vượt (qua )?địa hình|băng qua (địa hình|tường)/u
const TRUE_DAMAGE_WORDS = /thành sát thương chuẩn|đều là sát thương chuẩn|gây sát thương chuẩn/u
const EXECUTE = /(dưới|thấp hơn|ít hơn) \d+% máu|kết liễu|trảm|hành quyết/u
const ARMOR_SHRED = /giảm (\d+(?:\.\d+)?%? ?)?(\(\S+\) )?(giáp|kháng phép|giáp phép)(?! ?(của )?bản thân)/u
const VISION = /lộ diện|tầm nhìn/u
const DURATION = /(?:(\d+(?:\.\d+)?)\s*(?:-|–|đến|~)\s*)?(\d+(?:\.\d+)?)\s*giây/u

const strip = (text: string) => text.replace(/<[^>]+>/g, "")
const squash = (text: string) => text.replace(/\s+/g, " ").trim()
const lower = (text: string) => text.toLocaleLowerCase("vi")
const num = (value: unknown) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : NaN
  return Number.isFinite(parsed) ? parsed : null
}
// Seconds are a game number, written as the game writes them: a decimal point, no grouping (QUY-UOC-VIET §3).
const seconds = (value: number) => String(value)
const record = (value: unknown) =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null

/** Sentences of a description, split on line breaks and on full stops that end a clause. */
function sentences(description: string) {
  return strip(description)
    .split(/\n+|(?<=[^\d.])\.\s+|(?<=\d)\.\s+(?=[A-ZÀ-Ỹ])|;\s+/u)
    .map(squash)
    .filter((part) => part.length > 2)
}

function snapshot(skill: Skill) {
  return record(skill.effects.find((effect) => effect.effectType === "SOURCE_SNAPSHOT")?.metadata)
}

/**
 * Whether a sentence deals true damage, rather than naming it as damage the hero takes. Each damage word reads only
 * the words since the previous one, so "takes physical / true damage" stays damage taken.
 */
function dealsTrueDamage(text: string) {
  let from = 0
  for (const match of text.matchAll(/sát thương (vật lý|phép|chuẩn)/gu)) {
    const before = text.slice(Math.max(from, match.index - 170), match.index)
    from = match.index + match[0].length
    const numbers = [...before.matchAll(RATIO)].length > 0 || [...before.matchAll(BASE)].length > 0
    const dealt = /gây|chịu|kèm|cộng thêm|thành|thêm/u.test(before) || numbers
    const received = /(bản thân|khi) (phải )?chịu (\S+ ){0,3}$/u.test(before) && !numbers
    if (match[1] === "chuẩn" && dealt && !received) return true
  }
  return TRUE_DAMAGE_WORDS.test(text)
}

/** The kinds of the target's health a sentence turns into damage. */
function percentHealth(text: string) {
  const kinds = new Set<"MAX" | "CURRENT" | "MISSING">()
  const patterns: [RegExp, number][] = [
    [/(\d+(?:\.\d+)?)\s*%\s*máu (tối đa|hiện tại|đã mất)(?: của)? (mục tiêu|kẻ địch|nạn nhân|đối phương|địch)/gu, 2],
    [/máu (tối đa|hiện tại|đã mất) (?:của )?(?:mục tiêu|kẻ địch|nạn nhân) ?(\d+(?:\.\d+)?)\s*%/gu, 1],
    [/máu mục tiêu (tối đa|hiện tại|đã mất) (\d+(?:\.\d+)?)\s*%/gu, 1],
    [/(\d+(?:\.\d+)?)\s*%\s*máu (đã mất|hiện tại)(?= (?:chuyển )?thành sát thương| \(mỗi)/gu, 2],
    [/(?:thêm|kèm) máu (tối đa) mục tiêu/gu, 1],
  ]
  for (const [pattern, index] of patterns)
    for (const match of text.matchAll(pattern))
      kinds.add(match[index] === "tối đa" ? "MAX" : match[index] === "hiện tại" ? "CURRENT" : "MISSING")
  // A heal that reads the hero's own missing health is not damage.
  if (kinds.size && /hồi (\S+ ){0,6}máu đã mất/u.test(text) && !/sát thương/u.test(text)) return new Set()
  return kinds
}

interface ControlRead {
  type: Control
  seconds: number | null
  area: boolean
}

function crowdControl(text: string, skillArea: boolean): ControlRead[] {
  const found: ControlRead[] = []
  const scan = (list: { type: Control; pattern: RegExp }[], kind: "HARD" | "DISPLACE" | "SOFT") => {
    for (const entry of list) {
      const match = entry.pattern.exec(text)
      if (!match) continue
      // Immunity or cleansing sentences mention the effect without applying it.
      const around = text.slice(Math.max(0, match.index - 40), match.index)
      if (/miễn( nhiễm| dịch)?( hiệu ứng)? ?$|giải (trừ|khống)|không thể bị (\S+ ){0,2}$|kháng /u.test(around)) continue
      const after = text.slice(match.index, match.index + 90)
      // A pull or push that only moves minions and monsters is not crowd control on heroes.
      if (kind === "DISPLACE" && /^.{0,40}không phải tướng/u.test(after)) continue
      // A slow the hero puts on itself is a cost, not crowd control.
      if (kind === "SOFT" && /^\S+( \S+)? bản thân/u.test(after)) continue
      // Some text writes the duration before the effect word.
      const before = /(\d+(?:\.\d+)?)\s*giây\s*$/u.exec(text.slice(Math.max(0, match.index - 14), match.index))
      const range = DURATION.exec(after)
      const duration = range
        ? range[1]
          ? (num(range[1])! + num(range[2])!) / 2
          : num(range[2])
        : before
          ? num(before[1])
          : null
      found.push({ type: entry.type, seconds: duration, area: skillArea || AREA_CC.test(text) })
    }
  }
  scan(HARD_CC, "HARD")
  scan(DISPLACE, "DISPLACE")
  scan(SOFT, "SOFT")
  return found
}

/** The trait a kind of control gives; a slow gives none. */
const controlTrait = (type: Control): TraitCode | null =>
  type === "SLOW"
    ? null
    : type === "SILENCE"
      ? "SILENCE"
      : type === "KNOCK_BACK" || type === "PULL"
        ? "DISPLACE"
        : "HARD_CC"

/** The Vietnamese text and name a skill is read from; other languages have no reading rules. */
function vietnamese(skill: Skill) {
  const text = skill.translations.find((translation) => translation.locale === "vi-VN")
  return text ? { name: text.name || skillLabel(skill), description: text.description ?? "" } : null
}

/**
 * Suggests traits from the skills' Vietnamese text and tags, in the fixed trait order. A tag the game puts on a skill
 * counts even when the text words it otherwise; then the evidence names the tag instead of a sentence.
 */
export function suggestTraits(skills: Skill[]): TraitSuggestion[] {
  const found = new Map<TraitCode, { skillKeys: string[]; evidence: TraitSuggestion["evidence"]; parts: string[] }>()
  const add = (code: TraitCode, skill: Skill, evidence: string | null, part?: string) => {
    const entry = found.get(code) ?? { skillKeys: [], evidence: null, parts: [] }
    found.set(code, entry)
    if (!entry.skillKeys.includes(skill.skillKey)) entry.skillKeys.push(skill.skillKey)
    if (part && !entry.parts.includes(part)) entry.parts.push(part)
    if (!entry.evidence && evidence)
      entry.evidence = {
        skillKey: skill.skillKey,
        text: evidence.length > 220 ? `${evidence.slice(0, 217)}…` : evidence,
      }
  }

  for (const skill of skills) {
    const read = vietnamese(skill)
    if (!read) continue
    const meta = snapshot(skill)
    const tags = (Array.isArray(meta?.tags) ? meta.tags : [])
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => squash(strip(tag)))
    const cooldown = num(record(meta?.cooldown)?.value) ?? num(record(meta?.cooldown)?.seconds)
    const parts = sentences(read.description)
    const all = lower(squash(strip(read.description)))
    const sentence = (pattern: RegExp) => parts.find((part) => pattern.test(lower(part))) ?? null
    const tagged = (tag: string) => (tags.includes(tag) ? `Nhãn “${tag}” của game trên ${read.name}` : null)
    const skillArea = tags.includes("ST vùng")
    const controls: ControlRead[] = []

    for (const part of parts) {
      const text = lower(part)
      if (dealsTrueDamage(text)) add("TRUE_DAMAGE", skill, part)
      for (const kind of percentHealth(text))
        add(kind === "MISSING" ? "MISSING_HP_DAMAGE" : "PERCENT_HP_DAMAGE", skill, part)
      if (EXECUTE.test(text) && /sát thương|hạ gục|tiêu diệt/u.test(text)) add("MISSING_HP_DAMAGE", skill, part)
      if (ARMOR_SHRED.test(text) && !/giảm sát thương/u.test(text.slice(0, 12))) add("ARMOR_SHRED", skill, part)
      for (const control of crowdControl(text, skillArea)) {
        controls.push(control)
        const trait = controlTrait(control.type)
        if (trait) add(trait, skill, part)
      }
      if (ALLY.test(text)) {
        if (HEAL_SENTENCE.test(text)) add("ALLY_HEAL", skill, part)
        if (/lá chắn/u.test(text)) add("ALLY_SHIELD", skill, part)
        if (/tăng (\S+ ){0,6}(tốc chạy|tốc đánh|công|giáp|sát thương)|miễn (khống|thương)|giải (trừ|khống)/u.test(text))
          add("ALLY_BUFF", skill, part)
      }
      if (VISION.test(text)) add("VISION", skill, part)
      if (GLOBAL.test(text)) add("GLOBAL", skill, part)
      if (TERRAIN.test(text) && !/không xuyên/u.test(text)) add("WALL_CROSS", skill, part)
    }

    if (tags.includes("Chuẩn")) add("TRUE_DAMAGE", skill, tagged("Chuẩn"))
    for (const [tag, type] of Object.entries(TAG_CONTROL))
      if (tags.includes(tag) && !controls.some((control) => control.type === type)) {
        controls.push({ type, seconds: null, area: skillArea })
        const trait = controlTrait(type)
        if (trait) add(trait, skill, tagged(tag))
      }
    if (tags.includes("Khống chế") && !controls.length) {
      controls.push({ type: "OTHER", seconds: null, area: skillArea })
      add("HARD_CC", skill, tagged("Khống chế"))
    }
    // One detail part per kind of control on this skill: the skill name, then the effect, its seconds and its area.
    for (const control of controls) {
      const trait = controlTrait(control.type)
      if (!trait) continue
      const what = [
        `${CONTROL_LABEL[control.type]}${control.seconds ? ` ${seconds(control.seconds)} giây` : ""}`,
        control.area ? "diện rộng" : "",
      ]
        .filter(Boolean)
        .join(", ")
      found.get(trait)!.parts.push(`${read.name} (${what})`)
    }

    if (tags.includes("Dịch chuyển") || (skill.kind === "ACTIVE" && DASH_WORD.test(all)))
      add(
        "DASH",
        skill,
        tagged("Dịch chuyển") ?? sentence(DASH_WORD),
        `${read.name}${cooldown ? ` (hồi chiêu ${seconds(cooldown)} giây)` : ""}`,
      )
    if (tags.includes("Không bị khóa m.tiêu") || UNTARGETABLE.test(all))
      add("UNTARGETABLE", skill, sentence(UNTARGETABLE) ?? tagged("Không bị khóa m.tiêu"))
    if (tags.includes("Ẩn thân") || STEALTH.test(all)) add("STEALTH", skill, sentence(STEALTH) ?? tagged("Ẩn thân"))
    if (tags.includes("Lá chắn") || /lá chắn/u.test(all))
      add("SHIELD", skill, sentence(/lá chắn/u) ?? tagged("Lá chắn"))
    if (tags.includes("Hồi phục") || HEAL.test(all))
      add("SELF_HEAL", skill, sentence(HEAL_SENTENCE) ?? tagged("Hồi phục"))
    if (tags.includes("Miễn thương") || REDUCTION.test(all))
      add("DAMAGE_REDUCTION", skill, sentence(REDUCTION) ?? tagged("Miễn thương"))
    if (tags.includes("Miễn khống") || CC_IMMUNE.test(all))
      add("CC_IMMUNE", skill, sentence(CC_IMMUNE) ?? tagged("Miễn khống"))
    if (tags.includes("Giải khống") || CLEANSE.test(all))
      add("CLEANSE", skill, sentence(CLEANSE) ?? tagged("Giải khống"))
    const revive = ["Vô địch", "Miễn tử", "Hồi sinh"].find((tag) => tags.includes(tag))
    if (revive || /bất tử|hồi sinh|vô địch/u.test(all))
      add("REVIVE", skill, sentence(REVIVE) ?? (revive ? tagged(revive) : null))
  }

  return TRAITS.filter((trait) => found.has(trait.code)).map((trait) => {
    const entry = found.get(trait.code)!
    // Only crowd control and dashes have something to add to the skill names, which are shown anyway; the other
    // details are left for the editor to write, such as how long an immunity lasts.
    const detail = [...new Set(entry.parts)].join("; ").slice(0, TRAIT_DETAIL_MAX)
    return { code: trait.code, skillKeys: entry.skillKeys, evidence: entry.evidence, detail }
  })
}

/** The traits in their fixed order, with skill keys that still exist and blank details left out. */
export function cleanTraits(traits: Trait[], skills: Skill[]): Trait[] {
  const keys = skills.map((skill) => skill.skillKey)
  return [...traits]
    .sort((left, right) => (order.get(left.code) ?? 0) - (order.get(right.code) ?? 0))
    .map((trait) => ({
      code: trait.code,
      skillKeys: keys.filter((key) => trait.skillKeys.includes(key)),
      translations: trait.translations
        .map((text) => ({ locale: text.locale, detail: text.detail.trim() }))
        .filter((text) => text.detail),
    }))
}

/** The detail of a trait in a language, or nothing when it has not been written there. */
export const traitDetail = (trait: Trait, locale: string) =>
  trait.translations.find((text) => text.locale === locale)?.detail ?? ""

/** A trait with its detail in one language replaced, the other languages kept. */
export function withTraitDetail(trait: Trait, locale: string, detail: string): Trait {
  const others = trait.translations.filter((text) => text.locale !== locale)
  return { ...trait, translations: detail ? [...others, { locale, detail }] : others }
}
