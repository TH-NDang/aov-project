import type { HeroComparison } from "./publishing-api"
import type { Skill } from "./types"

export interface CuratedHeroChange {
  type: string
  skillKey?: string | null
  fieldKey?: string | null
  changeKind: string
  oldValue?: string | null
  newValue?: string | null
  description?: string | null
}

export interface SkillComparisonRow {
  id: string
  label: string
  before: unknown
  after: unknown
  kinds: string[]
}

export interface SkillComparisonGroup {
  skillKey: string
  name: string
  kind: "ADDED" | "REMOVED" | "CHANGED"
  beforeSkill: Skill | null
  afterSkill: Skill | null
  rows: SkillComparisonRow[]
  descriptions: { locale: string; before: string | null; after: string | null }[]
  kinds: string[]
}

type ValueRecord = Record<string, unknown>
type Fact = { id: string; label: string; value: unknown }
const record = (value: unknown): ValueRecord | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as ValueRecord) : null
const records = (value: unknown): ValueRecord[] =>
  Array.isArray(value) ? value.map(record).filter((item): item is ValueRecord => item !== null) : []
const text = (value: unknown) => (typeof value === "string" ? value : "")
const unique = (values: string[]) => [...new Set(values.filter(Boolean))]
const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replaceAll("đ", "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")

const fieldLabels: Record<string, string> = {
  cooldown: "Hồi chiêu",
  cooldownSeconds: "Hồi chiêu",
  energyCost: "Tiêu hao năng lượng",
  passiveAttackMultiplier: "Hệ số công vật lý nội tại khi kích hoạt",
  speedDurationSeconds: "Thời gian tăng tốc (giây)",
  heroDamage: "Sát thương lên tướng",
  bonusAttackCanCrit: "Chí mạng đòn đánh cường hóa",
  bonusPhysicalDamage: "Sát thương vật lý cộng thêm",
  magicDamage: "Sát thương phép",
  heal: "Hồi máu",
  damage: "Sát thương",
  physicalDamage: "Sát thương vật lý",
  initialReductionStacks: "Tầng giảm sát thương ban đầu",
  damageReductionPercentPerStack: "Giảm sát thương mỗi tầng (%)",
  maximumReductionStacks: "Số tầng tối đa",
  collisionDamage: "Sát thương va chạm",
  bonusDamage: "Sát thương cộng thêm",
  shield: "Lá chắn",
  initialMagicDamage: "Sát thương phép ban đầu",
  periodicMagicDamage: "Sát thương phép duy trì",
  empoweredPhysicalDamage: "Sát thương đòn đánh cường hóa",
  magicDefenseReduction: "Giảm giáp phép",
  reveal: "Lộ diện mục tiêu",
  vision: "Tầm nhìn",
  skill_1InnerAreaLink: "Liên kết Kim quang ấn",
  cannonSeparation: "Tách Pháo tử quang",
  stackDecay: "Giảm tầng cộng dồn",
  empoweredAttackDash: "Đột kích bằng đòn đánh cường hóa",
  empoweredAttackDashWithoutTarget: "Lướt khi không có mục tiêu",
  skill_2DetonationLink: "Liên kết kích nổ Lập phương thứ nguyên",
  doliaRefreshImmortality: "Miễn tử khi Dolia làm mới chiêu",
  collisionPhysicalDamage: "Sát thương vật lý va chạm",
  disease: "Dấu bệnh",
  evolution: "Tiến hóa kỹ năng",
  enhancement: "Cường hóa đòn đánh",
  evolutionThreshold: "Mốc tiến hóa",
  area: "Vùng tác động",
  waves: "Sóng phép",
  tags: "Đặc tính",
  name: "Tên kỹ năng",
  kind: "Loại kỹ năng",
  formKey: "Dạng tướng",
  iconAssetId: "Ảnh kỹ năng",
  duration: "Thời gian tác dụng",
  range: "Tầm tác động",
  radius: "Bán kính",
  value: "Giá trị",
  unit: "Đơn vị",
}

export const skillComparisonFieldLabel = (field: string) => fieldLabels[field.split(".").at(-1)!] ?? field

const aliases = new Map(
  Object.entries(fieldLabels).flatMap(([key, label]) => [
    [normalized(key), key === "cooldownSeconds" ? "cooldown" : key],
    [normalized(label), key === "cooldownSeconds" ? "cooldown" : key],
  ]),
)
for (const label of ["Hồi chiêu (giây)", "Hồi chiêu giây"]) aliases.set(normalized(label), "cooldown")
for (const label of ["Tiêu hao", "Năng lượng", "Năng lượng tiêu hao"]) aliases.set(normalized(label), "energyCost")
const fieldId = (key: string) => aliases.get(normalized(key.split(".").at(-1)!)) ?? normalized(key)

const noise = new Set(
  [
    "rawAttributes",
    "reviewFlags",
    "heroReviewFlags",
    "sourceHeroCode",
    "sourceImage",
    "sourceImageUrl",
    "sourceSlot",
    "displayedSkillNumber",
    "duplicateCaptures",
    "heroLevel",
    "completeness",
    "sources",
    "provenance",
    "review_required",
  ].map(normalized),
)

/** Stable comparison keeps object property order from creating a visible difference. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  const object = record(value)
  if (object)
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`)
      .join(",")}}`
  return JSON.stringify(value ?? null)
}
const same = (before: unknown, after: unknown) => canonical(before) === canonical(after)

function skillsIn(snapshot: ValueRecord): Skill[] {
  return records(record(snapshot.skills)?.skills).filter((skill) => text(skill.skillKey)) as unknown as Skill[]
}

function translatedName(skill: Skill | null, locale: string): string {
  const translations = skill?.translations ?? []
  return (
    translations.find((item) => item.locale === locale)?.name ||
    translations.find((item) => item.locale === "vi-VN")?.name ||
    translations.find((item) => item.name)?.name ||
    ""
  )
}

function descriptionChanges(before: Skill | null, after: Skill | null, locale: string) {
  const locales = unique([...(before?.translations ?? []), ...(after?.translations ?? [])].map((item) => item.locale))
  return locales
    .sort((a, b) => Number(b === locale) - Number(a === locale) || a.localeCompare(b))
    .flatMap((language) => {
      const oldText = before?.translations.find((item) => item.locale === language)?.description ?? null
      const newText = after?.translations.find((item) => item.locale === language)?.description ?? null
      return oldText === newText ? [] : [{ locale: language, before: oldText, after: newText }]
    })
}

/** Flatten unknown effect fields into readable facts without leaking capture provenance. */
function flattenFacts(value: unknown, id: string, label: string): Fact[] {
  const object = record(value)
  if (object)
    return Object.entries(object).flatMap(([key, item]) =>
      noise.has(normalized(key))
        ? []
        : flattenFacts(item, `${id}.${key}`, `${label} · ${skillComparisonFieldLabel(key)}`),
    )
  if (Array.isArray(value) && value.some((item) => record(item) || Array.isArray(item)))
    return value.flatMap((item, index) => flattenFacts(item, `${id}.${index}`, `${label} · ${index + 1}`))
  return value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length)
    ? []
    : [{ id, label, value }]
}

function displayFact(value: unknown, key: string): unknown {
  const item = record(value)
  if (!item) return value
  const display = text(item.display)
  if (display) return display.replace(/^(?:Hồi chiêu|Tiêu hao(?: năng lượng)?|Năng lượng)\s*:\s*/i, "")
  if (key === "cooldown" && typeof item.seconds === "number") return `${item.seconds} giây`
  if (typeof item.value === "number" || typeof item.value === "string")
    return item.unit ? `${item.value} ${item.unit}` : item.value
  return null
}

function skillFacts(skill: Skill | null): Map<string, Fact> {
  const facts = new Map<string, Fact>()
  if (!skill) return facts
  const add = (fact: Fact) => facts.set(fact.id, fact)
  for (const translation of skill.translations ?? [])
    if (translation.name)
      add({ id: `name.${translation.locale}`, label: `Tên kỹ năng (${translation.locale})`, value: translation.name })
  for (const key of ["kind", "formKey", "iconAssetId"] as const)
    if (skill[key] !== null && skill[key] !== undefined) add({ id: key, label: fieldLabels[key], value: skill[key] })
  for (const effect of skill.effects ?? []) {
    const metadata = record(effect.metadata) ?? {}
    if (effect.effectType !== "SOURCE_SNAPSHOT") {
      for (const fact of flattenFacts(metadata, `effect.${effect.effectType}`, effect.effectType)) add(fact)
      continue
    }
    for (const key of ["cooldown", "energyCost"] as const) {
      const value = displayFact(metadata[key], key)
      if (value !== undefined && value !== null && value !== "") add({ id: key, label: fieldLabels[key], value })
    }
    const table = record(metadata.levelTable)
    const columns = Array.isArray(table?.column_labels) ? table.column_labels : []
    const labelOccurrences = new Map<string, number>()
    const recordedRows = new Set<string>()
    for (const row of records(table?.rows)) {
      const label = text(row.label) || "Chưa có nhãn"
      const base = fieldId(label)
      const values = Array.isArray(row.display_values) ? row.display_values : []
      if (!values.length) continue
      const fingerprint = `${base}:${canonical(values)}`
      if (recordedRows.has(fingerprint)) continue
      recordedRows.add(fingerprint)
      const occurrence = labelOccurrences.get(base) ?? 0
      labelOccurrences.set(base, occurrence + 1)
      const id = occurrence ? `${base}.${occurrence}` : base
      add({
        id,
        label: fieldLabels[base] ?? label,
        value: values.map((value, index) => (columns[index] ? `${columns[index]}: ${value}` : value)),
      })
    }
    for (const [key, value] of Object.entries(metadata)) {
      if (noise.has(normalized(key)) || ["cooldown", "energyCost", "levelTable"].includes(key)) continue
      const visibleValue = key === "tags" && Array.isArray(value) ? [...new Set(value)].sort() : value
      for (const fact of flattenFacts(visibleValue, fieldId(key), skillComparisonFieldLabel(key))) add(fact)
    }
  }
  const known = new Set(["skillKey", "translations", "effects", "kind", "formKey", "iconAssetId", "displayOrder"])
  for (const [key, value] of Object.entries(skill)) {
    if (known.has(key) || noise.has(normalized(key))) continue
    for (const fact of flattenFacts(value, `skill.${key}`, skillComparisonFieldLabel(key))) add(fact)
  }
  return facts
}

function curatedRows(changes: CuratedHeroChange[]): SkillComparisonRow[] {
  const rows = new Map<string, SkillComparisonRow>()
  for (const change of changes) {
    if (!change.fieldKey) continue
    const field = fieldId(change.fieldKey)
    const before = change.oldValue ?? null
    const after = change.newValue ?? null
    if (same(before, after)) continue
    const fingerprint = `${field}:${canonical(before)}:${canonical(after)}`
    const previous = rows.get(fingerprint)
    if (previous) previous.kinds = unique([...previous.kinds, change.changeKind])
    else
      rows.set(fingerprint, {
        id: `curated.${fingerprint}`,
        label: skillComparisonFieldLabel(change.fieldKey),
        before,
        after,
        kinds: unique([change.changeKind]),
      })
  }
  return [...rows.values()]
}

/** Curated facts are valid only when the caller has matched the exact revision pair. */
export function buildSkillComparison(comparison: HeroComparison, locale: string, curated?: CuratedHeroChange[]) {
  const beforeSkills = new Map(skillsIn(comparison.before).map((skill) => [skill.skillKey, skill]))
  const afterSkills = new Map(skillsIn(comparison.after).map((skill) => [skill.skillKey, skill]))
  const skillChanges = (curated ?? []).filter(
    (change) => ["SKILL", "HERO_SKILL_CHANGE"].includes(change.type) && change.skillKey,
  )
  const keys = unique([
    ...beforeSkills.keys(),
    ...afterSkills.keys(),
    ...skillChanges.map((change) => change.skillKey!),
  ])
  const skills: SkillComparisonGroup[] = []
  for (const skillKey of keys) {
    const beforeSkill = beforeSkills.get(skillKey) ?? null
    const afterSkill = afterSkills.get(skillKey) ?? null
    const matching = skillChanges.filter((change) => change.skillKey === skillKey)
    const covered = new Set(matching.filter((change) => change.fieldKey).map((change) => fieldId(change.fieldKey!)))
    const rows = curatedRows(matching)
    const beforeFacts = skillFacts(beforeSkill)
    const afterFacts = skillFacts(afterSkill)
    for (const id of unique([...beforeFacts.keys(), ...afterFacts.keys()])) {
      if (covered.has(id)) continue
      if ((!beforeSkill || !afterSkill) && (id.startsWith("name.") || ["kind", "iconAssetId"].includes(id))) continue
      const oldFact = beforeFacts.get(id)
      const newFact = afterFacts.get(id)
      if (same(oldFact?.value, newFact?.value)) continue
      rows.push({
        id,
        label: newFact?.label ?? oldFact!.label,
        before: oldFact?.value ?? null,
        after: newFact?.value ?? null,
        kinds: [],
      })
    }
    const descriptions = descriptionChanges(beforeSkill, afterSkill, locale)
    if (!rows.length && !descriptions.length) continue
    skills.push({
      skillKey,
      name: translatedName(afterSkill, locale) || translatedName(beforeSkill, locale) || skillKey,
      kind: !beforeSkill ? "ADDED" : !afterSkill ? "REMOVED" : "CHANGED",
      beforeSkill,
      afterSkill,
      rows,
      descriptions,
      kinds: unique(matching.map((change) => change.changeKind)),
    })
  }
  skills.sort(
    (a, b) =>
      (a.afterSkill?.displayOrder ?? a.beforeSkill?.displayOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.afterSkill?.displayOrder ?? b.beforeSkill?.displayOrder ?? Number.MAX_SAFE_INTEGER) ||
      a.skillKey.localeCompare(b.skillKey),
  )
  return { skills, otherChanges: comparison.changes.filter((change) => change.section !== "skills") }
}
