import { isRecord } from "./import-relations"
import type { Section, Skill } from "../../api/types"

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
  if (flag.reviewResolution === "RESOLVED") return false
  return sourceReviewFlag(flag)
}

function sourceReviewFlag(flag: Record<string, unknown>): boolean {
  if (provenanceTypes.has(String(flag.type))) return false
  return !(
    flag.type === "not_visible_in_source" &&
    (flag.field === "hero.attributes.hero_level" || flag.field === "heroLevel")
  )
}

function reviewFlags(flags: unknown): { field: string; note: string; resolved: boolean }[] {
  if (!Array.isArray(flags)) return []
  return flags
    .filter(isRecord)
    .filter(sourceReviewFlag)
    .map((flag) => ({
      field: typeof flag.field === "string" ? flag.field : "",
      resolved: flag.reviewResolution === "RESOLVED",
      note:
        typeof flag.note === "string" && flag.note.trim()
          ? flag.note.trim()
          : "Nguồn hiện có chưa đủ thông tin; cần bổ sung và đối chiếu lại.",
    }))
}

export function sourceReviewNotes(flags: unknown): string[] {
  return [
    ...new Set(
      reviewFlags(flags)
        .filter((flag) => !flag.resolved)
        .map((flag) => flag.note),
    ),
  ]
}

export interface HeroReviewItem {
  note: string
  section?: Section
  skillKey?: string
  fields?: string[]
  resolved?: boolean
}

export function reviewTab(section: Section) {
  if (section === "SKILLS") return "skills"
  if (section === "SKINS") return "skins"
  if (section === "MEDIA_BINDINGS") return "media"
  return "overview"
}

function reviewSection(field: string): Section | undefined {
  switch (field.replace(/^hero\./, "").split(/[.\[]/)[0]) {
    case "attributes":
    case "heroLevel":
      return "COMBAT_STATS"
    case "overview_ratings":
      return "OVERVIEW_RATINGS"
    case "skills":
      return "SKILLS"
    case "skins":
      return "SKINS"
    case "media_bindings":
      return "MEDIA_BINDINGS"
    case "profile":
    case "roles":
    case "lanes":
    case "name":
    case "title":
    case "specialty":
    case "tip":
      return "PROFILE"
  }
}

export function heroReviewItems(skills: Skill[], includeResolved = false) {
  const items = new Map<string, HeroReviewItem>()
  const sources = skills.map((skill) => ({
    skill,
    source: skill.effects.find((effect) => effect.effectType === "SOURCE_SNAPSHOT")?.metadata,
  }))
  const handled = new Set<string>()
  function add(flag: ReturnType<typeof reviewFlags>[number], section?: Section, skillKey?: string) {
    const key = JSON.stringify([flag.note, section, skillKey])
    const previous = items.get(key)
    items.set(key, {
      note: flag.note,
      section,
      skillKey,
      fields: [...new Set([...(previous?.fields ?? []), flag.field])],
      resolved: flag.resolved && (previous?.resolved ?? true),
    })
  }
  for (const { skill, source } of sources) {
    for (const flag of reviewFlags(source?.reviewFlags ?? source?.review_flags)) {
      const { field, note } = flag
      handled.add(JSON.stringify([field, note]))
      const allSkills = field === "hero.skills" || field.startsWith("hero.skills[]")
      add(flag, "SKILLS", allSkills ? undefined : skill.skillKey)
    }
  }
  for (const { source } of sources) {
    for (const flag of reviewFlags(source?.heroReviewFlags)) {
      const { field, note } = flag
      const id = JSON.stringify([field, note])
      if (handled.has(id)) continue
      handled.add(id)
      const section = reviewSection(field)
      const match =
        section === "SKILLS" && !field.startsWith("hero.skills[]") && field !== "hero.skills"
          ? sources.filter(
              ({ skill, source }) => sourceSkillWarnings([{ field }], skill.displayOrder, source?.sourceSlot).length,
            )
          : []
      if (match.length === 1) add(flag, section, match[0].skill.skillKey)
      else add(flag, section)
    }
  }
  return [...items.values()].filter((item) => includeResolved || !item.resolved)
}

/** Resolve the selected warning and its duplicated hero-level flags without deleting source evidence. */
export function setHeroReviewResolved(skills: Skill[], item: HeroReviewItem, resolved: boolean): Skill[] {
  return skills.map((skill) => ({
    ...skill,
    effects: skill.effects.map((effect) => {
      if (effect.effectType !== "SOURCE_SNAPSHOT") return effect
      const metadata = { ...effect.metadata }
      for (const key of ["reviewFlags", "review_flags", "heroReviewFlags"]) {
        const flags = metadata[key]
        if (!Array.isArray(flags) || (key !== "heroReviewFlags" && item.skillKey && item.skillKey !== skill.skillKey))
          continue
        metadata[key] = flags.map((flag: unknown) => {
          const normalized = reviewFlags([flag])[0]
          if (
            !isRecord(flag) ||
            !normalized ||
            normalized.note !== item.note ||
            !item.fields?.includes(normalized.field)
          )
            return flag
          const next = { ...flag }
          if (resolved) next.reviewResolution = "RESOLVED"
          else delete next.reviewResolution
          return next
        })
      }
      return { ...effect, metadata }
    }),
  }))
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
