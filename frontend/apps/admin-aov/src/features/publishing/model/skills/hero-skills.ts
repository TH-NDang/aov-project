import { skillSlot } from "@aov/ui/lib/skill-rank-values"
import { groupSkillKit } from "@aov/ui/lib/skill-kit"
import type { Skill } from "../../api/types"
import { pickTranslation } from "@aov/ui/lib/translation-fallback"

export function selectSkillTranslation(skill: Skill, locale: string) {
  return pickTranslation(skill.translations, locale)
}

export { skillSlot }

export function skillVariant(skill: Skill): number | null {
  const match = /^skill-(\d+)-(\d+)$/.exec(skill.skillKey)
  return match && skillSlot(skill) === Number(match[1]) ? Number(match[2]) : null
}

export function skillVariantLabel(skill: Skill, skills: readonly Skill[]): string | undefined {
  if (skill.formKey) return
  const slot = skillSlot(skill)
  const variant = skillVariant(skill)
  if (slot === null || variant === null || skills.filter((item) => skillSlot(item) === slot).length < 2) return
  return `Biến thể ${variant}`
}

export interface HeroSkillGroup {
  key: string
  skills: Skill[]
}

/** Group only explicit slot/variant identities; unknown captures remain independent. Shared with the Wiki. */
export function groupHeroSkills(skills: readonly Skill[]): HeroSkillGroup[] {
  return groupSkillKit(skills)
}

export function skillLabel(skill: Skill) {
  if (skill.kind === "PASSIVE") return "Nội tại"
  const slot = skillSlot(skill)
  if (slot !== null && slot > 0) return `Chiêu ${slot}`
  return skill.kind === "ACTIVE" ? "Chủ động" : "Kỹ năng khác"
}
