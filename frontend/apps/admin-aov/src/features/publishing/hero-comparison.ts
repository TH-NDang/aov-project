export type DiffSegment = { type: "same" | "removed" | "added"; text: string }

export function plainComparisonText(text: string): string {
  return text.replace(
    /<color=#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})>|<ref=(?:hero|item|term):[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}>|<(?:noauto|b|i)>|<\/(?:color|ref|noauto|b|i)>/gi,
    "",
  )
}

/** Bound work for long source descriptions; never build an unbounded quadratic matrix. */
export function textDifference(before: string, after: string): DiffSegment[] {
  if (before === after) return [{ type: "same", text: before }]
  const tokenize = (text: string) => text.match(/\d+(?:[.,]\d+)?%?|[\p{L}\p{M}]+|\s+|[^\s\p{L}\p{M}\d]/gu) ?? []
  const a = tokenize(before)
  const b = tokenize(after)
  let prefix = 0
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++
  let suffix = 0
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  )
    suffix++
  const left = a.slice(prefix, a.length - suffix)
  const right = b.slice(prefix, b.length - suffix)
  const result: DiffSegment[] = []
  const push = (type: DiffSegment["type"], text: string) => {
    if (!text) return
    const last = result.at(-1)
    if (last?.type === type) last.text += text
    else result.push({ type, text })
  }
  push("same", a.slice(0, prefix).join(""))
  if (left.length * right.length > 250000) {
    push("removed", left.join(""))
    push("added", right.join(""))
  } else {
    const matrix = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1))
    for (let i = left.length - 1; i >= 0; i--)
      for (let j = right.length - 1; j >= 0; j--)
        matrix[i][j] = left[i] === right[j] ? matrix[i + 1][j + 1] + 1 : Math.max(matrix[i + 1][j], matrix[i][j + 1])
    let i = 0
    let j = 0
    while (i < left.length || j < right.length) {
      if (i < left.length && j < right.length && left[i] === right[j]) {
        push("same", left[i++])
        j++
      } else if (i < left.length && (j === right.length || matrix[i + 1][j] >= matrix[i][j + 1]))
        push("removed", left[i++])
      else push("added", right[j++])
    }
  }
  push("same", suffix ? a.slice(-suffix).join("") : "")
  return result
}

export function comparisonValue(value: unknown): string {
  if (value === null || value === undefined) return "Chưa ghi nhận"
  if (typeof value === "boolean") return value ? "Có" : "Không"
  if (typeof value === "number") return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 6 }).format(value)
  if (typeof value === "string") return value || "Trống"
  if (Array.isArray(value)) return value.map(comparisonValue).join(" · ") || "Trống"
  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => `${comparisonFieldLabels[key] ?? key}: ${comparisonValue(item)}`)
    .join("\n")
}

export const comparisonFieldLabels: Record<string, string> = {
  profile: "Thông tin",
  overviewRatings: "Đánh giá",
  combatStats: "Chỉ số",
  skills: "Kỹ năng",
  skins: "Trang phục",
  mediaBindings: "Ảnh tướng",
  name: "Tên",
  title: "Danh hiệu",
  summary: "Giới thiệu",
  lore: "Cốt truyện",
  description: "Mô tả",
  roles: "Vai trò",
  baseValue: "Giá trị ghi nhận",
  growthPerLevel: "Tăng mỗi cấp",
  unit: "Đơn vị",
  kind: "Loại",
  formKey: "Dạng tướng",
  iconAssetId: "Ảnh kỹ năng",
  artAssetId: "Ảnh trang phục",
  rarityCode: "Bậc",
  acquisitionNote: "Cách sở hữu",
  effects: "Thông số & nguồn",
  SOURCE_SNAPSHOT: "Thông số ghi nhận",
  metadata: "Thông số",
  cooldown: "Hồi chiêu",
  energyCost: "Tiêu hao năng lượng",
  levelTable: "Thông số theo cấp chiêu",
  rows: "Các chỉ số",
  display: "Giá trị",
  column_labels: "Nhãn cột",
  display_values: "Giá trị",
  label: "Tên chỉ số",
  locale: "Ngôn ngữ",
  skillKey: "Mã kỹ năng",
  effectType: "Loại thông tin",
  displayOrder: "Thứ tự",
  translations: "Bản dịch",
  survivability: "Sinh tồn",
  attackDamage: "Đánh thường",
  skillEffects: "Hiệu ứng kỹ năng",
  difficulty: "Độ khó",
  HEAD: "Ảnh đại diện",
  PORTRAIT: "Chân dung",
  SPLASH: "Ảnh nền",
  HP: "Máu",
  ARMOR: "Giáp",
  ATTACK_DAMAGE: "Công vật lý",
  MAGIC_DEFENSE: "Giáp phép",
  MOVEMENT_SPEED: "Tốc chạy",
  ABILITY_POWER: "Công phép",
  MAX_ENERGY: "Năng lượng tối đa",
  MAX_RESOURCE: "Tài nguyên tối đa",
  ARMOR_PIERCE: "Xuyên giáp",
  MAGIC_PIERCE: "Xuyên giáp phép",
  BONUS_ATTACK_SPEED: "Tốc đánh cộng thêm",
  CRITICAL_CHANCE: "Tỷ lệ chí mạng",
  CRITICAL_DAMAGE: "Sát thương chí mạng",
  PHYSICAL_LIFESTEAL: "Hút máu",
  MAGIC_LIFESTEAL: "Hút máu phép",
  COOLDOWN_REDUCTION: "Giảm hồi chiêu",
  values: "Thuộc tính",
}

export function comparisonPathLabels(
  section: string,
  path: string,
  snapshots: Record<string, unknown>[],
  locale: string,
): string[] {
  const parts = path
    .split("/")
    .filter(Boolean)
    .map((key) => key.replaceAll("~1", "/").replaceAll("~0", "~"))
  const record = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)
  const rows = snapshots.flatMap((snapshot) => {
    const value = snapshot[section]
    if (!record(value)) return []
    const collection = value[section]
    return Array.isArray(collection) ? collection.filter(record) : []
  })
  const labels = [comparisonFieldLabels[section] ?? section]
  for (const [index, key] of parts.entries()) {
    if (parts.includes("SOURCE_SNAPSHOT")) {
      if (["SOURCE_SNAPSHOT", "metadata"].includes(key)) continue
      if (key === "effects" && parts[index + 1] === "SOURCE_SNAPSHOT") continue
      if (key === "display" && index === parts.length - 1) continue
    }
    let label = comparisonFieldLabels[key] ?? key
    if (index > 0 && ["skills", "skins"].includes(parts[index - 1])) {
      const keyField = parts[index - 1] === "skills" ? "skillKey" : "skinKey"
      const row = rows.find((item) => item[keyField] === key)
      const translations = Array.isArray(row?.translations) ? row.translations.filter(record) : []
      const translation = translations.find((item) => item.locale === locale) ?? translations[0]
      if (typeof translation?.name === "string" && translation.name.trim()) label = translation.name
    }
    if (labels.at(-1) !== label) labels.push(label)
  }
  return labels
}
