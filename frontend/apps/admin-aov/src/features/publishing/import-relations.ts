import type { components } from "./generated/hero-api"
export type Relation = "skills" | "skins"
export interface RelationMapping {
  variants: string
  fields: Record<string, string>
}
export interface RelatedImage {
  section: Relation
  index: number
  field: string
  source: string
  semanticType: string
}
export type RelationField = components["schemas"]["ImportRelationField"]
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value)
export function pathValue(row: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value != null && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined,
      row,
    )
}
export function sourcePaths(rows: Record<string, unknown>[]): string[] {
  const paths = new Set<string>()
  function visit(value: Record<string, unknown>, prefix = "", depth = 0) {
    if (depth > 5) return
    for (const [key, item] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key
      paths.add(path)
      // Captured source metadata travels as one JSON field rather than individual mapping choices.
      if (
        key === "effects" &&
        Array.isArray(item) &&
        item.some((effect) => isRecord(effect) && effect.effectType === "SOURCE_SNAPSHOT")
      )
        continue
      if (isRecord(item)) visit(item, path, depth + 1)
      if (Array.isArray(item) && isRecord(item[0])) visit(item[0], `${path}.0`, depth + 1)
    }
  }
  rows.forEach((row) => visit(row))
  return [...paths]
}
export function relationRows(value: unknown, variants: string): Record<string, unknown>[] {
  const parsed = typeof value === "string" ? JSON.parse(value) : value
  if (parsed == null) return []
  if (!Array.isArray(parsed) || !parsed.every(isRecord)) throw new Error("Dữ liệu liên quan phải là mảng đối tượng.")
  return parsed.flatMap((row) => {
    if (!variants) return [row]
    const children = pathValue(row, variants)
    if (!Array.isArray(children) || !children.length || !children.every(isRecord))
      throw new Error(`Thiếu mảng biến thể: ${variants}`)
    return children.map((variant) => ({ ...row, variant }))
  })
}
export function defaultRelationMapping(value: unknown, section: Relation): RelationMapping {
  let rows: Record<string, unknown>[]
  try {
    rows = relationRows(value, "")
  } catch {
    return { variants: "", fields: {} }
  }
  const variants = section === "skills" && rows.some((row) => Array.isArray(row.variants)) ? "variants" : ""
  const paths = sourcePaths(rows)
  const first = (...names: string[]) => names.find((name) => paths.includes(name)) ?? ""
  return {
    variants,
    fields: {
      [section === "skills" ? "skillKey" : "skinKey"]:
        first(section === "skills" ? "skillKey" : "skinKey", "id") ||
        (section === "skills" && paths.includes("slot") ? "@slotKey" : ""),
      name: first("name", "translations.0.name"),
      description: first("description", "translations.0.description"),
      displayOrder: first("displayOrder") || "@order",
      ...(section === "skills"
        ? {
            kind: first("kind") || (paths.includes("slot") ? "@slotKind" : ""),
            formKey: first("formKey"),
            effects: first("effects"),
            iconAssetId: first("iconAssetId"),
          }
        : {
            rarityCode: first("rarityCode", "badgeId"),
            acquisitionNote: first("acquisitionNote", "translations.0.acquisitionNote"),
            artAssetId: first("artAssetId"),
          }),
    },
  }
}
export function mapRelation(
  section: Relation,
  value: unknown,
  mapping: RelationMapping,
  previous: unknown,
  locale: string,
  allowed: RelationField[],
): { rows: Record<string, unknown>[]; images: RelatedImage[] } {
  const keyField = section === "skills" ? "skillKey" : "skinKey"
  const imageField = section === "skills" ? "iconAssetId" : "artAssetId"
  const old = Array.isArray(previous) ? previous.filter(isRecord) : []
  const images: RelatedImage[] = []
  const seen = new Set<string>()
  const sourceRows = relationRows(value, mapping.variants)
  const partialCapture =
    section === "skills" &&
    !!mapping.fields.effects &&
    sourceRows.some((source) => {
      const value = pathValue(source, mapping.fields.effects)
      const effects = typeof value === "string" && value.trim() ? JSON.parse(value) : value
      return (
        Array.isArray(effects) && effects.some((effect) => isRecord(effect) && effect.effectType === "SOURCE_SNAPSHOT")
      )
    })
  const rows = sourceRows.map((source, index) => {
    const read = (field: string) => {
      const path = mapping.fields[field]
      if (path === "@slotKey") {
        if (!Number.isInteger(source.slot) || Number(source.slot) < 0)
          throw new Error("Slot kỹ năng phải là số nguyên không âm.")
        const variant = pathValue(source, "variant.index")
        if (mapping.variants && (!Number.isInteger(variant) || Number(variant) < 1))
          throw new Error("Biến thể cần index nguyên dương để tạo mã ổn định.")
        return `skill-${source.slot}${variant == null ? "" : `-${variant}`}`
      }
      if (path === "@order") return index
      if (path === "@slotKind") {
        if (!Number.isInteger(source.slot) || Number(source.slot) < 0)
          throw new Error("Cần slot nguyên không âm để xác định loại kỹ năng.")
        return source.slot === 0 ? "PASSIVE" : "ACTIVE"
      }
      return path ? pathValue(source, path) : undefined
    }
    const key = String(read(keyField) ?? "").trim()
    if (!key || seen.has(key)) throw new Error(`${section}: mã bản ghi trống hoặc trùng (${key}).`)
    seen.add(key)
    const existing = old.find((row) => row[keyField] === key)
    const translations = Array.isArray(existing?.translations) ? existing.translations.filter(isRecord) : []
    const translation = { ...(translations.find((t) => t.locale === locale) ?? {}), locale } as Record<string, unknown>
    const target: Record<string, unknown> = {
      ...(existing ?? {}),
      [keyField]: key,
      displayOrder: existing?.displayOrder ?? index,
      [imageField]: existing?.[imageField] ?? null,
    }
    if (section === "skills") {
      target.effects ??= []
      target.formKey ??= null
    } else target.rarityCode ??= null
    for (const field of allowed) {
      if (!mapping.fields[field.key] || field.key === keyField) continue
      const incoming = read(field.key)
      if (incoming == null || (typeof incoming === "string" && incoming.trim() === "")) continue
      if (field.type === "image") {
        const image = String(incoming).trim()
        if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(image)) target[field.key] = image
        else
          images.push({
            section,
            index,
            field: field.key,
            source: image,
            semanticType: section === "skills" ? "HERO_SKILL_ICON" : "HERO_SKIN_ART",
          })
      } else if (["name", "description", "acquisitionNote"].includes(field.key)) translation[field.key] = incoming
      else
        target[field.key] =
          field.type === "number"
            ? Number(incoming)
            : field.type === "json" && typeof incoming === "string"
              ? JSON.parse(incoming)
              : incoming
    }
    if (!translation.name) throw new Error(`${section} / ${key}: thiếu tên. Bổ sung tên để nhận diện bản nháp.`)
    if (section === "skills") translation.description ??= ""
    if (section === "skills" && !target.kind) throw new Error(`Kỹ năng ${key}: chưa ánh xạ loại kỹ năng.`)
    target.translations = [...translations.filter((t) => t.locale !== locale), translation]
    return target
  })
  if (partialCapture) {
    const remaining = old.filter((row) => !seen.has(String(row[keyField])))
    const usedOrders = new Set(rows.map((row) => Number(row.displayOrder)))
    let order = Math.max(-1, ...usedOrders) + 1
    for (const row of remaining) {
      while (usedOrders.has(order)) order++
      rows.push({ ...row, displayOrder: order })
      usedOrders.add(order++)
    }
  }
  return { rows, images }
}
