import { z } from "zod"
import { heroRatingScale } from "@aov/ui/lib/hero-rating-scale"
import { formatGameNumber } from "@aov/ui/lib/game-number"
import {
  POSITIONS,
  ROLES,
  type Content,
  type Position,
  type Role,
  type Section,
  type Skill,
  type Skin,
} from "@/lib/hero-types"
import { slugify } from "@/lib/text"
import { combatAttributeKeys, statUnit } from "../assessment/combat-attributes"
import { hasStatPercent } from "../assessment/stat-reading"
import { statLabel } from "../patch-changes/patch-change-model"
import { nextSkinKey } from "../skins/skin-keys"

/**
 * One plain JSON shape for a hero that a person or an AI assistant can fill in, in one language. It leaves out what only
 * Admin can know (pictures, sources, skill effects) and keeps the keys that tie a skill or a skin to what is saved.
 */
export const HERO_AI_FORMAT = "aov-hero/1"

/** The attack range is a code of its own, not a figure an assistant reads off the screen. */
const STAT_KEYS = combatAttributeKeys.filter((key) => key !== "ATTACK_RANGE_TYPE")
const KINDS = ["PASSIVE", "ACTIVE", "OTHER"] as const
const KIND_LABELS: Record<(typeof KINDS)[number], string> = {
  PASSIVE: "Nội tại",
  ACTIVE: "Chiêu chủ động",
  OTHER: "Khác",
}
const RATING_KEYS = ["survivability", "attackDamage", "skillEffects", "difficulty"] as const
const RATING_LABELS: Record<(typeof RATING_KEYS)[number], string> = {
  survivability: "Sinh tồn",
  attackDamage: "Đánh thường",
  skillEffects: "Hiệu ứng kỹ năng",
  difficulty: "Độ khó",
}

export interface HeroAiStat {
  value: number | null
  percent?: number | null
}

export interface HeroAiSkill {
  skillKey: string | null
  kind: (typeof KINDS)[number] | null
  order: number | null
  name: string | null
  description: string | null
  summary: string | null
}

export interface HeroAiSkin {
  skinKey: string | null
  rarityCode: string | null
  name: string | null
  description: string | null
  acquisitionNote: string | null
}

export interface HeroAiData {
  format: typeof HERO_AI_FORMAT
  locale: string
  code: string | null
  profile: {
    name: string | null
    title: string | null
    summary: string | null
    lore: string | null
    roles: Role[]
    positions: Position[]
  }
  ratings: Record<(typeof RATING_KEYS)[number], number | null>
  combatStats: Record<string, HeroAiStat>
  skills: HeroAiSkill[]
  skins: HeroAiSkin[]
}

export interface GuideField {
  /** Where the value sits in the JSON, as in `skills[].description`. */
  path: string
  label: string
  type: string
  note: string
  /** Whether this hero already has the value in the chosen language. */
  filled?: boolean
}

export interface GuideGroup {
  section: Section
  title: string
  fields: GuideField[]
}

const blank = (value: string | null | undefined) => !value?.trim()
const textIn = <T extends { locale: string }>(translations: readonly T[] | undefined, locale: string) =>
  translations?.find((text) => text.locale === locale)

function ratingFactor(content: Content) {
  return heroRatingScale(content.OVERVIEW_RATINGS?.scaleCode || "GAME_OVERVIEW_10")
}

const shown = (value: number | null | undefined) => (value == null || Number.isNaN(value) ? null : value)

/** The hero as the template shows it: what is saved in `locale`, null where nothing is written yet. */
export function heroAiData(content: Content, locale: string, code: string | null): HeroAiData {
  const profile = content.PROFILE
  const profileText = textIn(profile?.translations, locale)
  const scale = ratingFactor(content)
  const ratings = content.OVERVIEW_RATINGS
  const stats = new Map(content.COMBAT_STATS?.values.map((row) => [row.statKey, row]))
  const skills = [...(content.SKILLS?.skills ?? [])].sort((a, b) => a.displayOrder - b.displayOrder)
  const skins = [...(content.SKINS?.skins ?? [])].sort((a, b) => a.displayOrder - b.displayOrder)
  return {
    format: HERO_AI_FORMAT,
    locale,
    code,
    profile: {
      name: profileText?.name || null,
      title: profileText?.title ?? null,
      summary: profileText?.summary ?? null,
      lore: profileText?.lore ?? null,
      roles: [...(profile?.roles ?? [])],
      positions: [...(profile?.positions ?? [])],
    },
    ratings: Object.fromEntries(
      RATING_KEYS.map((key) => {
        const value = shown(ratings?.[key])
        return [key, value == null ? null : value / scale.factor]
      }),
    ) as HeroAiData["ratings"],
    combatStats: Object.fromEntries(
      STAT_KEYS.map((key) => {
        const row = stats.get(key)
        const value = shown(row?.baseValue)
        return [key, hasStatPercent(key) ? { value, percent: shown(row?.percentValue) } : { value }]
      }),
    ),
    // A hero with no skills yet gets the usual passive and three abilities to fill in.
    skills: skills.length
      ? skills.map((skill) => {
          const text = textIn(skill.translations, locale)
          return {
            skillKey: skill.skillKey,
            kind: skill.kind,
            order: skill.displayOrder,
            name: text?.name || null,
            description: text?.description || null,
            summary: text?.summary ?? null,
          }
        })
      : [0, 1, 2, 3].map((slot) => ({
          skillKey: `skill-${slot}-1`,
          kind: slot ? "ACTIVE" : "PASSIVE",
          order: slot,
          name: null,
          description: null,
          summary: null,
        })),
    skins: skins.map((skin) => {
      const text = textIn(skin.translations, locale)
      return {
        skinKey: skin.skinKey,
        rarityCode: skin.rarityCode,
        name: text?.name || null,
        description: text?.description ?? null,
        acquisitionNote: text?.acquisitionNote ?? null,
      }
    }),
  }
}

const roleList = Object.entries(ROLES)
  .map(([code, label]) => `${code} (${label})`)
  .join(", ")
const positionList = Object.entries(POSITIONS)
  .map(([code, label]) => `${code} (${label})`)
  .join(", ")

/** Every field of the template with what it means, grouped like the hero page, and whether this hero has it. */
export function heroAiGuide(content: Content, locale: string): GuideGroup[] {
  const profileText = textIn(content.PROFILE?.translations, locale)
  const ratings = content.OVERVIEW_RATINGS
  const stats = new Map(content.COMBAT_STATS?.values.map((row) => [row.statKey, row]))
  const skills = content.SKILLS?.skills ?? []
  const skins = content.SKINS?.skins ?? []
  const scale = ratingFactor(content)
  const every = <T>(rows: readonly T[], has: (row: T) => boolean) => rows.length > 0 && rows.every(has)
  return [
    {
      section: "PROFILE",
      title: "Thông tin",
      fields: [
        {
          path: "profile.name",
          label: "Tên tướng",
          type: "chữ",
          note: "Tên trong game.",
          filled: !blank(profileText?.name),
        },
        {
          path: "profile.title",
          label: "Danh hiệu",
          type: "chữ",
          note: "Dòng ngắn dưới tên, ví dụ “Ninja rồng”.",
          filled: !blank(profileText?.title),
        },
        {
          path: "profile.summary",
          label: "Giới thiệu",
          type: "chữ",
          note: "Câu gợi ý cách chơi trên trang tướng trong game.",
          filled: !blank(profileText?.summary),
        },
        {
          path: "profile.lore",
          label: "Cốt truyện",
          type: "chữ nhiều dòng",
          note: "Tiểu sử của tướng, xuống dòng bằng \\n.",
          filled: !blank(profileText?.lore),
        },
        {
          path: "profile.roles",
          label: "Vai trò",
          type: "danh sách mã",
          note: `Một hoặc hai mã: ${roleList}.`,
          filled: !!content.PROFILE?.roles.length,
        },
        {
          path: "profile.positions",
          label: "Đường",
          type: "danh sách mã",
          note: `Các đường tướng hay đi: ${positionList}.`,
          filled: !!content.PROFILE?.positions?.length,
        },
      ],
    },
    {
      section: "OVERVIEW_RATINGS",
      title: "Đánh giá",
      fields: RATING_KEYS.map((key) => ({
        path: `ratings.${key}`,
        label: RATING_LABELS[key],
        type: `số 0–${scale.maximum}`,
        note: `Số vạch sáng trên thang ${scale.maximum} ở màn giới thiệu tướng.`,
        filled: shown(ratings?.[key]) != null,
      })),
    },
    {
      section: "COMBAT_STATS",
      title: "Chỉ số",
      fields: STAT_KEYS.map((key) => ({
        path: `combatStats.${key}`,
        label: statLabel(key),
        type: hasStatPercent(key)
          ? "{ value, percent }"
          : statUnit(key) === "PERCENT"
            ? "{ value } phần trăm"
            : "{ value }",
        note: hasStatPercent(key)
          ? "Như game ghi “150 | 20%”: value là 150, percent là 20."
          : statUnit(key) === "PERCENT"
            ? "Số phần trăm ở cấp 1, như game ghi."
            : "Số ở cấp 1, như game ghi.",
        filled: shown(stats.get(key)?.baseValue) != null,
      })),
    },
    {
      section: "SKILLS",
      title: "Kỹ năng",
      fields: [
        {
          path: "skills[].skillKey",
          label: "Mã kỹ năng",
          type: "chữ",
          note: "Giữ nguyên mã đã có. skill-0-1 là nội tại, skill-1-1 đến skill-3-1 là chiêu 1 đến 3.",
        },
        {
          path: "skills[].kind",
          label: "Loại",
          type: "mã",
          note: KINDS.map((kind) => `${kind} (${KIND_LABELS[kind]})`).join(", ") + ".",
        },
        { path: "skills[].order", label: "Thứ tự", type: "số", note: "0 cho nội tại, rồi 1, 2, 3." },
        {
          path: "skills[].name",
          label: "Tên kỹ năng",
          type: "chữ",
          note: "Tên trong game.",
          filled: every(skills, (skill) => !blank(textIn(skill.translations, locale)?.name)),
        },
        {
          path: "skills[].description",
          label: "Mô tả",
          type: "chữ nhiều dòng",
          note: "Chép đúng mô tả trong game, giữ nguyên số liệu.",
          filled: every(skills, (skill) => !blank(textIn(skill.translations, locale)?.description)),
        },
        {
          path: "skills[].summary",
          label: "Tóm tắt",
          type: "chữ",
          note: "Một câu ngắn bằng lời thường về tác dụng của chiêu.",
          filled: every(skills, (skill) => !blank(textIn(skill.translations, locale)?.summary)),
        },
      ],
    },
    {
      section: "SKINS",
      title: "Trang phục",
      fields: [
        {
          path: "skins[].skinKey",
          label: "Mã trang phục",
          type: "chữ",
          note: "Giữ nguyên mã đã có; trang phục mới để null, Admin tự đặt mã theo tên.",
        },
        { path: "skins[].rarityCode", label: "Bậc", type: "mã", note: "Chỉ để tham khảo; đổi bậc trong Admin." },
        {
          path: "skins[].name",
          label: "Tên trang phục",
          type: "chữ",
          note: "Tên trong game.",
          filled: every(skins, (skin) => !blank(textIn(skin.translations, locale)?.name)),
        },
        {
          path: "skins[].description",
          label: "Mô tả",
          type: "chữ",
          note: "Mô tả trong cửa hàng, nếu có.",
          filled: every(skins, (skin) => !blank(textIn(skin.translations, locale)?.description)),
        },
        {
          path: "skins[].acquisitionNote",
          label: "Cách nhận",
          type: "chữ",
          note: "Ví dụ: mua bằng quân huy, quà sự kiện.",
          filled: every(skins, (skin) => !blank(textIn(skin.translations, locale)?.acquisitionNote)),
        },
      ],
    },
  ]
}

const LOCALE_NAMES: Record<string, string> = { "vi-VN": "tiếng Việt", "en-US": "tiếng Anh" }

/** What to send an AI assistant: the rules, the meaning of each field and the JSON to fill in. */
export function heroAiPrompt(heroName: string, data: HeroAiData, guide: GuideGroup[]) {
  const language = LOCALE_NAMES[data.locale] ?? data.locale
  const fields = guide
    .flatMap((group) => [
      `\n${group.title}:`,
      ...group.fields.map((field) => `- ${field.path} (${field.label}, ${field.type}): ${field.note}`),
    ])
    .join("\n")
  return [
    `Bạn đang giúp nhập dữ liệu tướng ${heroName || "mới"} của Liên Quân Mobile (Arena of Valor) cho một wiki.`,
    `Hãy điền JSON bên dưới bằng ${language}, đúng như trong game.`,
    "",
    "Quy tắc:",
    "- Trả về đúng một khối JSON, không kèm lời giải thích.",
    "- Giữ nguyên format, locale, code và các skillKey, skinKey đã có.",
    "- Giá trị nào không chắc chắn thì để null. Không đoán hay bịa số liệu.",
    "- Giữ nguyên giá trị đã có nếu không có thông tin mới chính xác hơn.",
    "- Có thể thêm kỹ năng hoặc trang phục còn thiếu vào cuối danh sách.",
    "",
    `Ý nghĩa các trường:${fields}`,
    "",
    "JSON cần điền:",
    "```json",
    JSON.stringify(data, null, 2),
    "```",
  ].join("\n")
}

// The assistant's answer: lenient about numbers written as text and about fields it left out, strict about codes.
const looseNumber = z.preprocess(
  (value) => (typeof value === "string" && value.trim() !== "" ? Number(value.replace(",", ".")) : value),
  z.number().finite().nullable().optional(),
)
const looseText = z.string().nullable().optional()
const answerSchema = z.object({
  format: z.literal(HERO_AI_FORMAT, { error: `Thiếu "format": "${HERO_AI_FORMAT}" của mẫu.` }),
  locale: z.string().min(2),
  code: z.string().nullable().optional(),
  profile: z
    .object({
      name: looseText,
      title: looseText,
      summary: looseText,
      lore: looseText,
      roles: z
        .array(z.enum(Object.keys(ROLES) as [Role, ...Role[]]))
        .nullable()
        .optional(),
      positions: z
        .array(z.enum(Object.keys(POSITIONS) as [Position, ...Position[]]))
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  ratings: z.partialRecord(z.enum(RATING_KEYS), looseNumber).nullable().optional(),
  combatStats: z
    .record(z.string(), z.union([looseNumber, z.object({ value: looseNumber, percent: looseNumber }).nullable()]))
    .nullable()
    .optional(),
  skills: z
    .array(
      z.object({
        skillKey: looseText,
        kind: z.enum(KINDS).nullable().optional(),
        order: looseNumber,
        name: looseText,
        description: looseText,
        summary: looseText,
      }),
    )
    .nullable()
    .optional(),
  skins: z
    .array(
      z.object({
        skinKey: looseText,
        rarityCode: looseText,
        name: looseText,
        description: looseText,
        acquisitionNote: looseText,
      }),
    )
    .nullable()
    .optional(),
})
export type HeroAiAnswer = z.infer<typeof answerSchema>

export type ParsedAnswer = { ok: true; answer: HeroAiAnswer } | { ok: false; message: string }

/** Reads what the assistant answered, also when it wrapped the JSON in a code block or a sentence. */
export function parseHeroAiAnswer(text: string): ParsedAnswer {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end <= start) return { ok: false, message: "Không thấy khối JSON nào trong nội dung đã dán." }
  let raw: unknown
  try {
    raw = JSON.parse(text.slice(start, end + 1))
  } catch (cause) {
    return { ok: false, message: `JSON không hợp lệ: ${cause instanceof Error ? cause.message : String(cause)}` }
  }
  const result = answerSchema.safeParse(raw)
  if (result.success) return { ok: true, answer: result.data }
  const issue = result.error.issues[0]!
  const where = issue.path.length ? `${issue.path.join(".")}: ` : ""
  return { ok: false, message: `${where}${issue.message}` }
}

/** What a change shows on the left when nothing was there to replace. */
export const NO_VALUE = "(trống)"
export const NOT_YET = "(chưa có)"

export interface HeroAiChange {
  section: Section
  label: string
  before: string
  after: string
}

export interface HeroAiResult {
  content: Content
  changes: HeroAiChange[]
  warnings: string[]
}

const present = (value: string | null | undefined): value is string => !!value?.trim()
const number = (value: number | null | undefined): value is number => value != null && Number.isFinite(value)
const clip = (value: string) => (value.length > 160 ? `${value.slice(0, 157)}…` : value)
const textValue = (value: string | null | undefined) => (present(value) ? clip(value.trim()) : NO_VALUE)
const numberValue = (value: number | null | undefined) => (number(value) ? formatGameNumber(value, 12) : NO_VALUE)

/**
 * Puts the assistant's answer into the content. Only written values count: a field left out, null or empty keeps what
 * is saved, so nothing is erased by an answer that skipped it. Pictures, sources and skill effects are never touched.
 */
export function applyHeroAiAnswer(content: Content, answer: HeroAiAnswer): HeroAiResult {
  const locale = answer.locale
  const changes: HeroAiChange[] = []
  const warnings: string[] = []
  const next: Content = structuredClone(content)

  const profile = answer.profile
  if (profile) {
    const current = next.PROFILE ?? { translations: [], roles: [], positions: [], sources: [] }
    let text = textIn(current.translations, locale)
    const textFields = ["name", "title", "summary", "lore"] as const
    const written = textFields.filter((field) => present(profile[field]))
    if (written.length && !text && !present(profile.name)) {
      warnings.push(
        `Hồ sơ chưa có bản ${locale}: cần điền profile.name trước khi thêm danh hiệu, giới thiệu hay cốt truyện.`,
      )
    } else if (written.length) {
      if (!text) {
        text = { locale, name: "", title: null, summary: null, lore: null }
        current.translations = [...current.translations, text]
      }
      for (const field of written) {
        const after = profile[field]!.trim()
        if ((text[field] ?? "") === after) continue
        changes.push({
          section: "PROFILE",
          label: { name: "Tên tướng", title: "Danh hiệu", summary: "Giới thiệu", lore: "Cốt truyện" }[field],
          before: textValue(text[field]),
          after: clip(after),
        })
        text[field] = after
      }
    }
    if (profile.roles?.length && [...profile.roles].sort().join() !== [...current.roles].sort().join()) {
      changes.push({
        section: "PROFILE",
        label: "Vai trò",
        before: current.roles.map((role) => ROLES[role]).join(", ") || NO_VALUE,
        after: profile.roles.map((role) => ROLES[role]).join(", "),
      })
      current.roles = [...new Set(profile.roles)]
    }
    const positions = current.positions ?? []
    if (profile.positions?.length && [...profile.positions].sort().join() !== [...positions].sort().join()) {
      changes.push({
        section: "PROFILE",
        label: "Đường",
        before: positions.map((position) => POSITIONS[position]).join(", ") || NO_VALUE,
        after: profile.positions.map((position) => POSITIONS[position]).join(", "),
      })
      current.positions = [...new Set(profile.positions)]
    }
    if (changes.some((change) => change.section === "PROFILE")) next.PROFILE = current
  }

  const ratings = answer.ratings
  if (ratings) {
    const current = next.OVERVIEW_RATINGS ?? {
      scaleCode: "GAME_OVERVIEW_10",
      survivability: NaN,
      attackDamage: NaN,
      skillEffects: NaN,
      difficulty: NaN,
      derived: false,
      sources: [],
    }
    const scale = heroRatingScale(current.scaleCode || "GAME_OVERVIEW_10")
    let changed = false
    for (const key of RATING_KEYS) {
      const value = ratings[key]
      if (!number(value)) continue
      if (value < 0 || value > scale.maximum) {
        warnings.push(`Bỏ qua ${RATING_LABELS[key]} = ${value}: phải từ 0 đến ${scale.maximum}.`)
        continue
      }
      const stored = Math.round(value * scale.factor)
      if (current[key] === stored) continue
      changes.push({
        section: "OVERVIEW_RATINGS",
        label: RATING_LABELS[key],
        before: number(current[key])
          ? `${formatGameNumber(current[key] / scale.factor, 2)}/${scale.maximum}`
          : NO_VALUE,
        after: `${formatGameNumber(stored / scale.factor, 2)}/${scale.maximum}`,
      })
      current[key] = stored
      changed = true
    }
    // The values no longer come from counting bars on a capture once they are typed in.
    if (changed) next.OVERVIEW_RATINGS = { ...current, derived: false }
  }

  const stats = answer.combatStats
  if (stats) {
    const current = next.COMBAT_STATS ?? { values: [], sources: [] }
    const values = [...current.values]
    let changed = false
    for (const [key, raw] of Object.entries(stats)) {
      if (!STAT_KEYS.includes(key)) {
        if (raw != null) warnings.push(`Bỏ qua chỉ số không có trong mẫu: ${key}.`)
        continue
      }
      const reading = typeof raw === "object" && raw !== null ? raw : { value: raw, percent: undefined }
      const index = values.findIndex((row) => row.statKey === key)
      const row =
        index >= 0
          ? values[index]!
          : { statKey: key, baseValue: null, percentValue: null, growthPerLevel: null, unit: statUnit(key) }
      const value = number(reading.value) ? reading.value : row.baseValue
      const percent = hasStatPercent(key) && number(reading.percent) ? reading.percent : (row.percentValue ?? null)
      if (value === row.baseValue && percent === (row.percentValue ?? null)) continue
      const show = (base: number | null | undefined, extra: number | null | undefined) =>
        hasStatPercent(key) && number(extra)
          ? `${numberValue(base)} | ${formatGameNumber(extra, 12)}%`
          : numberValue(base)
      changes.push({
        section: "COMBAT_STATS",
        label: statLabel(key),
        before: show(row.baseValue, row.percentValue),
        after: show(value, percent),
      })
      const updated = { ...row, baseValue: value, ...(hasStatPercent(key) ? { percentValue: percent } : {}) }
      if (index >= 0) values[index] = updated
      else values.push(updated)
      changed = true
    }
    if (changed) next.COMBAT_STATS = { ...current, values }
  }

  if (answer.skills?.length) {
    const current = next.SKILLS ?? { skills: [], sources: [] }
    const skills = [...current.skills]
    let changed = false
    for (const incoming of answer.skills) {
      const label = incoming.name?.trim() || incoming.skillKey || "kỹ năng"
      let index = incoming.skillKey ? skills.findIndex((skill) => skill.skillKey === incoming.skillKey) : -1
      if (index < 0 && present(incoming.name)) {
        const slug = slugify(incoming.name)
        index = skills.findIndex((skill) => skill.translations.some((text) => slugify(text.name) === slug))
      }
      if (index < 0) {
        if (!present(incoming.name) || !present(incoming.description)) {
          if (present(incoming.name) || present(incoming.description))
            warnings.push(`Bỏ qua kỹ năng mới “${label}”: cần cả tên và mô tả.`)
          continue
        }
        const skill: Skill = {
          skillKey: freeSkillKey(skills, incoming.skillKey, incoming.kind),
          kind: incoming.kind ?? "ACTIVE",
          formKey: null,
          displayOrder: number(incoming.order)
            ? incoming.order
            : Math.max(-1, ...skills.map((row) => row.displayOrder)) + 1,
          iconAssetId: null,
          translations: [
            {
              locale,
              name: incoming.name.trim(),
              description: incoming.description.trim(),
              summary: incoming.summary?.trim() || null,
            },
          ],
          effects: [],
          stateIcons: [],
        }
        skills.push(skill)
        changes.push({
          section: "SKILLS",
          label: `Thêm kỹ năng ${skill.skillKey}`,
          before: NOT_YET,
          after: clip(skill.translations[0]!.name),
        })
        changed = true
        continue
      }
      const skill = { ...skills[index]!, translations: [...skills[index]!.translations] }
      const textIndex = skill.translations.findIndex((text) => text.locale === locale)
      const text = textIndex >= 0 ? { ...skill.translations[textIndex]! } : null
      if (!text && (!present(incoming.name) || !present(incoming.description))) {
        if (present(incoming.name) || present(incoming.description) || present(incoming.summary))
          warnings.push(`Kỹ năng ${skill.skillKey} chưa có bản ${locale}: cần cả tên và mô tả.`)
        continue
      }
      const target = text ?? { locale, name: "", description: "", summary: null }
      let touched = false
      for (const field of ["name", "description", "summary"] as const) {
        const value = incoming[field]
        if (!present(value) || (target[field] ?? "") === value.trim()) continue
        changes.push({
          section: "SKILLS",
          label: `${skill.translations.find((row) => row.locale === locale)?.name || skill.skillKey} · ${{ name: "tên", description: "mô tả", summary: "tóm tắt" }[field]}`,
          before: textValue(target[field]),
          after: clip(value.trim()),
        })
        target[field] = value.trim()
        touched = true
      }
      if (!touched) continue
      if (textIndex >= 0) skill.translations[textIndex] = target
      else skill.translations.push(target)
      skills[index] = skill
      changed = true
    }
    if (changed) next.SKILLS = { ...current, skills }
  }

  if (answer.skins?.length) {
    const current = next.SKINS ?? { skins: [], sources: [] }
    const skins = [...current.skins]
    let changed = false
    for (const incoming of answer.skins) {
      let index = incoming.skinKey ? skins.findIndex((skin) => skin.skinKey === incoming.skinKey) : -1
      if (index < 0 && present(incoming.name)) {
        const slug = slugify(incoming.name)
        index = skins.findIndex((skin) => skin.translations.some((text) => slugify(text.name) === slug))
      }
      if (index < 0) {
        if (!present(incoming.name)) {
          if (present(incoming.description) || present(incoming.acquisitionNote))
            warnings.push("Bỏ qua một trang phục mới không có tên.")
          continue
        }
        const name = incoming.name.trim()
        const skin: Skin = {
          skinKey: nextSkinKey(skins, name),
          displayOrder: Math.max(-1, ...skins.map((row) => row.displayOrder)) + 1,
          artAssetId: null,
          headAssetId: null,
          portraitAssetId: null,
          rarityCode: null,
          translations: [
            {
              locale,
              name,
              description: incoming.description?.trim() || null,
              acquisitionNote: incoming.acquisitionNote?.trim() || null,
            },
          ],
        }
        skins.push(skin)
        changes.push({ section: "SKINS", label: "Thêm trang phục", before: NOT_YET, after: clip(name) })
        changed = true
        continue
      }
      const skin = { ...skins[index]!, translations: [...skins[index]!.translations] }
      const textIndex = skin.translations.findIndex((text) => text.locale === locale)
      if (textIndex < 0 && !present(incoming.name)) {
        if (present(incoming.description) || present(incoming.acquisitionNote))
          warnings.push(`Trang phục ${skin.skinKey} chưa có bản ${locale}: cần điền tên.`)
        continue
      }
      const target =
        textIndex >= 0
          ? { ...skin.translations[textIndex]! }
          : { locale, name: "", description: null, acquisitionNote: null }
      let touched = false
      for (const field of ["name", "description", "acquisitionNote"] as const) {
        const value = incoming[field]
        if (!present(value) || (target[field] ?? "") === value.trim()) continue
        changes.push({
          section: "SKINS",
          label: `${skin.translations.find((row) => row.locale === locale)?.name || skin.skinKey} · ${{ name: "tên", description: "mô tả", acquisitionNote: "cách nhận" }[field]}`,
          before: textValue(target[field]),
          after: clip(value.trim()),
        })
        target[field] = value.trim()
        touched = true
      }
      if (!touched) continue
      if (textIndex >= 0) skin.translations[textIndex] = target
      else skin.translations.push(target)
      skins[index] = skin
      changed = true
    }
    if (changed) next.SKINS = { ...current, skins }
  }

  return { content: next, changes, warnings }
}

/** The key the assistant gave when it is a free skill key, else the next free slot after the hero's skills. */
function freeSkillKey(
  skills: readonly Skill[],
  wanted: string | null | undefined,
  kind: Skill["kind"] | null | undefined,
) {
  const used = new Set(skills.map((skill) => skill.skillKey))
  if (wanted && /^skill-\d+-\d+$/.test(wanted) && !used.has(wanted)) return wanted
  if (kind === "PASSIVE" && !used.has("skill-0-1")) return "skill-0-1"
  const slots = skills.map((skill) => Number(/^skill-(\d+)-/.exec(skill.skillKey)?.[1] ?? 0))
  let slot = Math.max(0, ...slots) + 1
  while (used.has(`skill-${slot}-1`)) slot++
  return `skill-${slot}-1`
}
