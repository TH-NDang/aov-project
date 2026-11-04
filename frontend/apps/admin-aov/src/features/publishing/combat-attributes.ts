import { statLabel } from "./patch-change-model"
import { plainComparisonText } from "./hero-comparison"
import { isRecord } from "./import-relations"
import type { components } from "./generated/hero-api"
import type { Content, Role, Skills, Stats } from "./types"

export type StatDefault = components["schemas"]["PatchStatDefault"]
export type StatSample = components["schemas"]["HeroStatSample"]

type Group = "Cơ bản" | "Tấn công"
type Attribute = { key: string; field: string; group: Group; percent?: string }
const attributes: Attribute[] = [
  { key: "HP", field: "health", group: "Cơ bản" },
  { key: "ATTACK_DAMAGE", field: "physicalAttack", group: "Cơ bản" },
  { key: "ABILITY_POWER", field: "magicAttack", group: "Cơ bản" },
  { key: "ARMOR", field: "physicalDefense", percent: "physicalDefensePercent", group: "Cơ bản" },
  { key: "MAGIC_DEFENSE", field: "magicDefense", percent: "magicDefensePercent", group: "Cơ bản" },
  { key: "MAX_RESOURCE", field: "maxResource", group: "Cơ bản" },
  { key: "MOVEMENT_SPEED", field: "movementSpeed", group: "Tấn công" },
  { key: "ATTACK_RANGE_TYPE", field: "attackRange", group: "Tấn công" },
  { key: "ARMOR_PIERCE", field: "physicalPierce", percent: "physicalPiercePercent", group: "Tấn công" },
  { key: "MAGIC_PIERCE", field: "magicPierce", percent: "magicPiercePercent", group: "Tấn công" },
  { key: "BONUS_ATTACK_SPEED", field: "bonusAttackSpeedPercent", group: "Tấn công" },
  { key: "CRITICAL_CHANCE", field: "criticalChancePercent", group: "Tấn công" },
  { key: "CRITICAL_DAMAGE", field: "criticalDamagePercent", group: "Tấn công" },
  { key: "PHYSICAL_LIFESTEAL", field: "physicalLifestealPercent", group: "Tấn công" },
  { key: "MAGIC_LIFESTEAL", field: "magicLifestealPercent", group: "Tấn công" },
  { key: "COOLDOWN_REDUCTION", field: "cooldownReductionPercent", group: "Tấn công" },
]

const fields = new Map(attributes.map((a) => [a.key, a]))

export function statUnit(key: string) {
  return fields.get(key)?.field.endsWith("Percent") ? "PERCENT" : "POINT"
}

export interface StatReading {
  value?: number | string
  unit: string
  percent?: number
  resource?: string
}

export function observedStat(key: string, values?: Record<string, unknown>): StatReading | undefined {
  const field = fields.get(key)
  if (!field || !values) return
  const raw = values[field.field]
  const component = field.percent && values[field.percent]
  const percent = typeof component === "number" && Number.isFinite(component) ? component : undefined
  const value =
    typeof raw === "number" && Number.isFinite(raw)
      ? raw
      : key === "ATTACK_RANGE_TYPE" && typeof raw === "string" && raw.trim()
        ? raw.trim()
        : undefined
  if (value === undefined && percent === undefined) return
  const resource =
    key === "MAX_RESOURCE" && typeof values.resourceLabel === "string" ? values.resourceLabel.trim() : undefined
  return { value, percent, unit: statUnit(key), resource }
}

export function normalizedUnit(key: string, unit: string) {
  const normalized = unit.trim().toUpperCase()
  return key === "HP" && normalized === "HP" ? "POINT" : normalized
}

export function formatStat(value: number, unit: string) {
  const suffix = { POINT: "", HP: "", UNKNOWN: "", PERCENT: "%", percent: "%" }[unit] ?? (unit ? " " + unit : "")
  return value.toLocaleString("vi-VN", { useGrouping: false, maximumFractionDigits: 12 }) + suffix
}

export function overviewAttackStats(roles: Role[], skills: Skills | null) {
  const both = ["ATTACK_DAMAGE", "ABILITY_POWER"]
  if (roles.includes("MAGE")) return roles.includes("MARKSMAN") ? both : ["ABILITY_POWER"]
  if (roles.includes("MARKSMAN")) return ["ATTACK_DAMAGE"]

  const descriptions =
    skills?.skills
      .filter((skill) => skill.kind === "ACTIVE")
      .flatMap((skill) => skill.translations.map((text) => plainComparisonText(text.description)))
      .join(" ") ?? ""
  const physical = /\d\s*%\s*(?:tổng\s+)?(?:công vật lý|(?:bonus )?attack damage)(?!\p{L})/iu.test(descriptions)
  const magic = /\d\s*%\s*(?:tổng\s+)?(?:công phép|ability power)(?!\p{L})/iu.test(descriptions)
  if (physical && magic) return both
  if (magic) return ["ABILITY_POWER"]
  if (physical || roles.includes("WARRIOR") || roles.includes("ASSASSIN")) return ["ATTACK_DAMAGE"]
  return both
}

export function observedAttributes(skills?: Skills | null) {
  for (const skill of skills?.skills ?? []) {
    for (const effect of skill.effects) {
      const observation = effect.metadata.observedAttributes
      if (
        effect.effectType !== "SOURCE_SNAPSHOT" ||
        !isRecord(observation) ||
        !isRecord(observation.values) ||
        observation.method !== "MANUAL_VISUAL_TRANSCRIPTION" ||
        observation.scope !== "DISPLAYED_SNAPSHOT_NOT_LEVEL_ONE"
      )
        continue
      return {
        values: observation.values,
        patchCode: typeof effect.metadata.patchCode === "string" ? effect.metadata.patchCode : undefined,
        image:
          isRecord(observation.source) && typeof observation.source.file_name === "string"
            ? observation.source.file_name
            : undefined,
        level: typeof observation.heroLevel === "number" ? observation.heroLevel : null,
      }
    }
  }
}

export interface AttributeRow {
  key: string
  label: string
  group: Group | "Khác"
  value: string
  kind: "Giá trị riêng" | "Ghi nhận từ ảnh" | "Mặc định của patch" | "Chưa ghi nhận"
  growth?: number | null
  observed?: string
  reference?: StatDefault
  matchesDefault: boolean
  reading?: StatReading
}

export function combatAttributeRows(
  stats: Stats | null,
  observation: ReturnType<typeof observedAttributes>,
  defaults: StatDefault[],
): AttributeRow[] {
  const heroes = new Map(stats?.values.map((v) => [v.statKey, v]))
  const shared = new Map(defaults.map((v) => [v.statKey, v]))
  const keys = new Set([...fields.keys(), ...heroes.keys(), ...shared.keys()])
  return Array.from(keys).flatMap<AttributeRow>((key) => {
    const definition = fields.get(key)
    const own = heroes.get(key)
    const reference = shared.get(key)
    const capture = observedStat(key, observation?.values)
    let observed = typeof capture?.value === "number" ? formatStat(capture.value, capture.unit) : capture?.value
    if (capture?.percent !== undefined) observed = (observed ?? "—") + " | " + formatStat(capture.percent, "PERCENT")
    if (!own && !reference && !observation) return []
    const ownValue = own?.baseValue != null ? formatStat(own.baseValue, own.unit) : undefined
    const fallback = reference && formatStat(reference.baseValue, reference.unit)
    const reading =
      own?.baseValue != null ? { value: own.baseValue, unit: own.unit, resource: capture?.resource } : capture
    const kind =
      ownValue != null
        ? "Giá trị riêng"
        : observed != null
          ? "Ghi nhận từ ảnh"
          : reference
            ? "Mặc định của patch"
            : "Chưa ghi nhận"
    const label =
      key === "ATTACK_RANGE_TYPE"
        ? "Tầm đánh"
        : key === "MAX_RESOURCE" && typeof observation?.values.resourceLabel === "string"
          ? observation.values.resourceLabel
          : statLabel(key)
    return [
      {
        key,
        label,
        group: definition?.group ?? "Khác",
        value: ownValue ?? observed ?? fallback ?? "—",
        kind,
        growth: own?.growthPerLevel,
        observed,
        reference,
        matchesDefault:
          !!reference && reading?.value === reference.baseValue && normalizedUnit(key, reading.unit) === reference.unit,
        reading,
      },
    ]
  })
}

export function statPatchContext(
  variants: { id: string; patchCode: string; rulesetId: string }[],
  revision: { rulesetId: string; effectiveFromPatchVariantId: string | null } | undefined,
  selected: string | null,
  content: Content | undefined,
) {
  if (!revision) return undefined
  const scoped = variants.filter((v) => v.rulesetId === revision.rulesetId)
  const target = selected || revision.effectiveFromPatchVariantId
  if (target) return scoped.find((v) => v.id === target)
  const captured = observedAttributes(content?.SKILLS)?.patchCode
  return scoped.find((v) => v.patchCode === captured)
}
