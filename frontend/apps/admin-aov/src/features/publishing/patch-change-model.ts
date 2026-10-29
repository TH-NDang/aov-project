import { randomId } from "@/lib/random-id"
import { localized } from "./hero-content"
import type { ChangeSource, Content, Role } from "./types"

export type ChangeKind = "BUFF" | "NERF" | "ADJUSTMENT" | "REWORK" | "FIX" | "OTHER"
export type ChangeRowType = "STAT" | "SKILL" | "ROLE" | "VISUAL" | "MECHANIC" | "OTHER"

export const KIND_LABELS: Record<ChangeKind, string> = {
  BUFF: "Tăng sức mạnh",
  NERF: "Giảm sức mạnh",
  ADJUSTMENT: "Điều chỉnh",
  REWORK: "Làm lại",
  FIX: "Sửa lỗi",
  OTHER: "Khác",
}

export const ROW_TYPE_LABELS: Record<ChangeRowType, string> = {
  STAT: "Chỉ số",
  SKILL: "Kỹ năng",
  ROLE: "Vai trò",
  VISUAL: "Ảnh",
  MECHANIC: "Cơ chế",
  OTHER: "Khác",
}

export const SOURCE_LABELS: Record<ChangeSource, string> = {
  SNAPSHOT: "Đối chiếu bản dữ liệu",
  PATCH_NOTES: "Ghi chú cập nhật",
}

export const STAT_LABELS: Record<string, string> = {
  HP: "Máu",
  ATTACK_DAMAGE: "Công vật lý",
  ABILITY_POWER: "Công phép",
  ARMOR: "Giáp",
  MAGIC_DEFENSE: "Giáp phép",
  ARMOR_PIERCE: "Xuyên giáp",
  MAGIC_PIERCE: "Xuyên giáp phép",
  MOVEMENT_SPEED: "Tốc chạy",
  MAX_ENERGY: "Năng lượng tối đa",
  MAX_RESOURCE: "Tài nguyên tối đa",
  BONUS_ATTACK_SPEED: "Tốc đánh cộng thêm",
  CRITICAL_CHANCE: "Tỉ lệ chí mạng",
  CRITICAL_DAMAGE: "Sát thương chí mạng",
  PHYSICAL_LIFESTEAL: "Hút máu vật lý",
  MAGIC_LIFESTEAL: "Hút máu phép",
  COOLDOWN_REDUCTION: "Giảm hồi chiêu",
}

export const UNIT_LABELS: Record<string, string> = { PERCENT: "%", UNKNOWN: "", POINT: "" }

/** Common skill fields; editors may still type another key the notes name. */
export const SKILL_FIELDS: Record<string, string> = {
  cooldown: "Hồi chiêu",
  damage: "Sát thương",
  energyCost: "Tiêu hao năng lượng",
  duration: "Thời gian hiệu lực",
  range: "Tầm",
  shield: "Lá chắn",
  heal: "Hồi máu",
  slow: "Làm chậm",
  stun: "Khống chế",
  magicDamage: "Sát thương phép",
  physicalDamage: "Sát thương vật lý",
  trueDamage: "Sát thương chuẩn",
  description: "Mô tả",
}

export const statLabel = (key: string) => STAT_LABELS[key] ?? key
/** Imported keys may be scoped, such as "skill_2.magicDamage"; the last segment names the field. */
export const skillFieldLabel = (key: string) => SKILL_FIELDS[key] ?? SKILL_FIELDS[key.split(".").pop() ?? ""] ?? key

export interface ChangeRow {
  id: string
  type: ChangeRowType
  kind: ChangeKind | ""
  /** Stat key, skill key, role code, media role or mechanic key depending on the type. */
  key: string
  field: string
  unit: string
  oldValue: string
  newValue: string
  added: boolean
  description: string
}

export function emptyRow(type: ChangeRowType = "STAT"): ChangeRow {
  return {
    id: randomId(),
    type,
    kind: "",
    key: "",
    field: "",
    unit: "",
    oldValue: "",
    newValue: "",
    added: true,
    description: "",
  }
}

export interface StatOption {
  key: string
  label: string
  unit: string
  current: number | null
}
export interface SkillOption {
  key: string
  label: string
}

export function statOptions(content: Content | null | undefined): StatOption[] {
  return (content?.COMBAT_STATS?.values ?? []).map((stat) => ({
    key: stat.statKey,
    label: statLabel(stat.statKey),
    unit: stat.unit,
    current: stat.baseValue ?? null,
  }))
}

export function skillOptions(content: Content | null | undefined, locale: string): SkillOption[] {
  return [...(content?.SKILLS?.skills ?? [])]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((skill, index) => ({
      key: skill.skillKey,
      label: localized(skill.translations, locale)?.name || `Kỹ năng ${index + 1}`,
    }))
}

/** Rows the snapshots already prove; the editor still chooses each row's kind. */
export function suggestedRows(before: Content | null, after: Content, locale: string): ChangeRow[] {
  const rows: ChangeRow[] = []
  const previous = new Map((before?.COMBAT_STATS?.values ?? []).map((stat) => [stat.statKey, stat]))
  for (const stat of after.COMBAT_STATS?.values ?? []) {
    const old = previous.get(stat.statKey)?.baseValue ?? null
    if (old === stat.baseValue) continue
    rows.push({
      ...emptyRow("STAT"),
      key: stat.statKey,
      unit: stat.unit,
      oldValue: old === null ? "" : String(old),
      newValue: stat.baseValue === null ? "" : String(stat.baseValue),
    })
  }
  const oldRoles = new Set(before?.PROFILE?.roles ?? [])
  const newRoles = new Set(after.PROFILE?.roles ?? [])
  for (const role of newRoles) if (!oldRoles.has(role)) rows.push({ ...emptyRow("ROLE"), key: role, added: true })
  for (const role of oldRoles) if (!newRoles.has(role)) rows.push({ ...emptyRow("ROLE"), key: role, added: false })
  const oldSkills = new Map((before?.SKILLS?.skills ?? []).map((skill) => [skill.skillKey, skill]))
  for (const skill of after.SKILLS?.skills ?? []) {
    const old = localized(oldSkills.get(skill.skillKey)?.translations, locale)?.description ?? ""
    const next = localized(skill.translations, locale)?.description ?? ""
    if (oldSkills.has(skill.skillKey) && old !== next)
      rows.push({ ...emptyRow("SKILL"), key: skill.skillKey, field: "description", oldValue: old, newValue: next })
  }
  return rows
}

const number = (value: string) => (value.trim() === "" ? null : Number(value.replace(",", ".")))

/** Mirrors the server rules so mistakes show next to the row instead of after a round trip. */
export function rowProblem(row: ChangeRow, source: ChangeSource): string | null {
  if (!row.kind) return "Chọn tính chất thay đổi."
  const notes = source === "PATCH_NOTES"
  switch (row.type) {
    case "STAT": {
      if (!row.key) return "Chọn chỉ số."
      const before = number(row.oldValue)
      const after = number(row.newValue)
      if ((before !== null && Number.isNaN(before)) || (after !== null && Number.isNaN(after)))
        return "Giá trị chỉ số phải là số."
      if (notes && (before === null || after === null)) return "Ghi cả giá trị trước và sau theo ghi chú cập nhật."
      if (before === after) return "Giá trị trước và sau đang giống nhau."
      return null
    }
    case "SKILL":
      if (!row.key) return "Chọn kỹ năng."
      if (!row.field.trim()) return "Ghi trường thay đổi, ví dụ hồi chiêu."
      if (notes && (!row.oldValue.trim() || !row.newValue.trim()))
        return "Ghi cả giá trị trước và sau theo ghi chú cập nhật."
      if (row.oldValue === row.newValue) return "Giá trị trước và sau đang giống nhau."
      return null
    case "ROLE":
      return row.key ? null : "Chọn vai trò."
    case "VISUAL":
      if (notes) return "Thay đổi ảnh cần bản dữ liệu, không ghi từ ghi chú cập nhật."
      return row.key ? null : "Chọn loại ảnh."
    case "MECHANIC":
      if (!row.key.trim()) return "Ghi tên cơ chế."
      return row.description.trim() ? null : "Mô tả thay đổi cơ chế."
    case "OTHER":
      return row.description.trim() ? null : "Mô tả thay đổi."
  }
}

/** The server accepts each stat, skill field and role once per change set from patch notes. */
export function duplicateRows(rows: ChangeRow[]): Set<string> {
  const seen = new Map<string, string>()
  const duplicates = new Set<string>()
  for (const row of rows) {
    const identity =
      row.type === "STAT" || row.type === "ROLE"
        ? `${row.type}:${row.key}`
        : row.type === "SKILL"
          ? `SKILL:${row.key}:${row.field.trim()}`
          : null
    if (!identity || !row.key) continue
    if (seen.has(identity)) duplicates.add(row.id)
    else seen.set(identity, row.id)
  }
  return duplicates
}

export function changePayload(row: ChangeRow) {
  const base = { type: row.type, changeKind: row.kind }
  switch (row.type) {
    case "STAT":
      return {
        ...base,
        statKey: row.key,
        unit: row.unit || "UNKNOWN",
        oldValue: number(row.oldValue),
        newValue: number(row.newValue),
      }
    case "SKILL":
      return {
        ...base,
        skillKey: row.key,
        fieldKey: row.field.trim(),
        oldValue: row.oldValue || null,
        newValue: row.newValue || null,
      }
    case "ROLE":
      return { ...base, roleCode: row.key, added: row.added }
    case "VISUAL":
      return { ...base, mediaRole: row.key, oldAssetId: row.oldValue || null, newAssetId: row.newValue || null }
    case "MECHANIC":
      return { ...base, mechanicKey: row.key.trim(), description: row.description.trim() }
    case "OTHER":
      return { ...base, description: row.description.trim() }
  }
}

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value.trim())
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export type Provenance = "OBSERVED" | "DERIVED" | "CARRIED"
export type Direction = "EXACT" | "FORWARD" | "BACKWARD" | "NONE"

export interface HeroPatchView {
  heroId: string
  patchVariantId: string
  anchor: { direction: Direction; revisionId: string | null; patchVariantId: string | null }
  stats: {
    statKey: string
    unit: string
    baseValue: number | null
    growthPerLevel: number | null
    provenance: Provenance
    changeSetId: string | null
    patchVariantId: string | null
  }[]
  roles: { roleCode: Role; provenance: Provenance; changeSetId: string | null; patchVariantId: string | null }[]
  skillFields: {
    skillKey: string
    fieldKey: string
    value: string | null
    provenance: Provenance
    changeSetId: string
    patchVariantId: string
  }[]
  appliedChangeSetIds: string[]
}

export const PROVENANCE_LABELS: Record<Provenance, string> = {
  OBSERVED: "Đã quan sát",
  DERIVED: "Suy ra",
  CARRIED: "Chưa xác minh",
}

export function directionText(direction: Direction, anchorPatch: string | null) {
  switch (direction) {
    case "EXACT":
      return "Dữ liệu đã xuất bản đúng patch này."
    case "FORWARD":
      return `Lấy bản ${anchorPatch ?? "trước đó"} rồi áp giá trị mới của các thay đổi sau đó.`
    case "BACKWARD":
      return `Lấy bản ${anchorPatch ?? "sau đó"} rồi lùi lại theo giá trị cũ trong các ghi chú cập nhật.`
    case "NONE":
      return "Tướng chưa có bản dữ liệu đã xuất bản trong bộ quy tắc này."
  }
}
