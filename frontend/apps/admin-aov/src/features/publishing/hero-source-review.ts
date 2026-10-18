import { isRecord } from "./import-relations"

const provenanceTypes = new Set([
  "unlabeled_icons",
  "screenshot_color_sampling",
  "representative_screenshot_colors",
  "visual_bar_measurement",
  "raw_labels_and_values",
  "duplicate_source_file",
])

/** Keep content warnings even when their status says only the visible fragment was preserved. */
export function sourceContentWarning(flag: Record<string, unknown>): boolean {
  if (provenanceTypes.has(String(flag.type))) return false
  return !(flag.type === "not_visible_in_source" && flag.field === "hero.attributes.hero_level")
}

export function sourceReviewNotes(flags: unknown): string[] {
  if (!Array.isArray(flags)) return []
  return [
    ...new Set(
      flags
        .filter(isRecord)
        .filter(sourceContentWarning)
        .map((flag) =>
          typeof flag.note === "string" && flag.note.trim()
            ? flag.note
            : "Nguồn hiện có chưa đủ thông tin; cần bổ sung và đối chiếu lại.",
        ),
    ),
  ]
}

export function sourceSkillWarnings(
  flags: Record<string, unknown>[],
  index: number,
  slot: unknown,
): Record<string, unknown>[] {
  const prefixes = [`hero.skills[${index}]`, `hero.skills.${index}`]
  if (typeof slot === "string" && slot) prefixes.push(`hero.skills.${slot}`)
  return flags.filter((flag) => {
    const field = flag.field
    if (!sourceContentWarning(flag) || typeof field !== "string") return false
    return (
      field === "hero.skills" ||
      field === "hero.skills[]" ||
      field.startsWith("hero.skills[].") ||
      prefixes.some((prefix) => field === prefix || field.startsWith(`${prefix}.`))
    )
  })
}

/** Source links are navigation only; credentials and executable URL schemes are never retained. */
export function sourceHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value.trim())) return null
  try {
    const url = new URL(value.trim())
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.href.length > 2000)
      return null
    return url.href
  } catch {
    return null
  }
}
