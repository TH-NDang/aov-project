import type { Content } from "../api/types"

export type TranslatableSection = "PROFILE" | "SKILLS" | "SKINS"
export const translationFields = {
  name: "Tên",
  title: "Danh hiệu",
  summary: "Giới thiệu",
  lore: "Cốt truyện",
  description: "Mô tả",
  acquisitionNote: "Cách sở hữu",
} as const
export type TranslationField = keyof typeof translationFields
export type TranslationText = { locale: string } & Partial<Record<TranslationField, string | null>>
export type TranslationTarget = {
  section: TranslatableSection
  key: string
  field: TranslationField
  sourceLocale: string
}
export const sectionTextFields: Record<TranslatableSection, readonly TranslationField[]> = {
  PROFILE: ["name", "title", "summary", "lore"],
  SKILLS: ["name", "summary", "description"],
  SKINS: ["name", "description", "acquisitionNote"],
}

/** A skill's `summary` is its short plain summary, while a hero's is the introduction. */
export const translationFieldLabel = (section: TranslatableSection, field: TranslationField): string =>
  section === "SKILLS" && field === "summary" ? "Tóm tắt" : translationFields[field]

export function translationSource(rows: readonly TranslationText[], field: TranslationField, preferred = "vi-VN") {
  return rows.find((row) => row.locale === preferred && row[field]?.trim()) ?? rows.find((row) => row[field]?.trim())
}

/** Resolve each field separately so an incomplete translation never hides the available source text. */
export function translatedText<T extends TranslationText>(
  rows: readonly T[],
  locale: string,
  fields: readonly TranslationField[],
): T | undefined {
  const target = rows.find((row) => row.locale === locale)
  const base = target ?? rows.find((row) => row.locale === "vi-VN") ?? rows[0]
  if (!base) return undefined
  const text = { ...base }
  for (const field of fields) {
    const source = target?.[field]?.trim() ? target : translationSource(rows, field)
    if (source) Object.assign(text, { [field]: source[field] })
  }
  return text
}

export function missingTranslationFields(
  rows: readonly TranslationText[],
  locale: string,
  fields: readonly TranslationField[],
) {
  const target = rows.find((row) => row.locale === locale)
  return fields.flatMap((field) => {
    const source = translationSource(rows, field)
    return source && !target?.[field]?.trim() ? [{ field, sourceLocale: source.locale }] : []
  })
}

export function heroTranslationGroups(content: Content) {
  return [
    ...(content.PROFILE ? [{ section: "PROFILE" as const, key: "profile", rows: content.PROFILE.translations }] : []),
    ...(content.SKILLS?.skills ?? []).map((skill) => ({
      section: "SKILLS" as const,
      key: skill.skillKey,
      rows: skill.translations,
    })),
    ...(content.SKINS?.skins ?? []).map((skin) => ({
      section: "SKINS" as const,
      key: skin.skinKey,
      rows: skin.translations,
    })),
  ]
}

/** Progress belongs to the supplied revision and only includes fields with actual source content. */
export function translationStatus(content: Content, locale: string) {
  const groups = heroTranslationGroups(content)
    .map((group) => {
      const fields = sectionTextFields[group.section]
      const total = fields.filter((field) => translationSource(group.rows, field)).length
      const missing = missingTranslationFields(group.rows, locale, fields).map((entry) => ({
        ...entry,
        section: group.section,
        key: group.key,
      }))
      const exists = group.rows.some(
        (row) => row.locale === locale && fields.some((field) => (row as TranslationText)[field]?.trim()),
      )
      return { ...group, total, missing, exists }
    })
    .filter((group) => group.total > 0)
  const completed = groups.filter((group) => !group.missing.length)
  const missing = groups.flatMap((group) => group.missing)
  const totalFields = groups.reduce((sum, group) => sum + group.total, 0)
  return {
    completed: completed.length,
    total: groups.length,
    profile: completed.some((group) => group.section === "PROFILE"),
    skills: completed.filter((group) => group.section === "SKILLS").length,
    skins: completed.filter((group) => group.section === "SKINS").length,
    exists: groups.some((group) => group.exists),
    completedFields: totalFields - missing.length,
    totalFields,
    missing,
  }
}

export function translationStatusLabel(progress: ReturnType<typeof translationStatus>) {
  if (!progress.totalFields) return "Chưa có nội dung nguồn"
  if (!progress.missing.length) return "Đủ nội dung"
  return progress.exists ? `Đã dịch một phần · còn ${progress.missing.length} mục` : "Chưa có bản dịch"
}
