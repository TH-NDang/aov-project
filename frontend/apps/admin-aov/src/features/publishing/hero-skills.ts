import type { Skill } from "./types"

export function selectSkillTranslation(skill: Skill, locale: string) {
  return (
    skill.translations.find((text) => text.locale === locale) ??
    skill.translations.find((text) => text.locale === "vi-VN") ??
    skill.translations[0]
  )
}

export function skillSlot(skill: Skill): number | null {
  const snapshot = skill.effects.find((effect) => effect.effectType === "SOURCE_SNAPSHOT")?.metadata
  if (typeof snapshot?.sourceSlot === "number" && Number.isInteger(snapshot.sourceSlot) && snapshot.sourceSlot >= 0)
    return snapshot.sourceSlot
  const match = /^skill-(\d+)-(\d+)$/.exec(skill.skillKey)
  return match ? Number(match[1]) : null
}

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

/** Group only explicit slot/variant identities; unknown captures remain independent. */
export function groupHeroSkills(skills: readonly Skill[]): HeroSkillGroup[] {
  const ordered = [...skills].sort((a, b) => a.displayOrder - b.displayOrder)
  const slots = new Map<number, Skill[]>()
  for (const skill of ordered) {
    const slot = skillSlot(skill)
    if (slot === null || skillVariant(skill) === null) continue
    slots.set(slot, [...(slots.get(slot) ?? []), skill])
  }
  const grouped = new Map<number, Skill[]>()
  for (const [slot, members] of slots) {
    if (members.length > 1 && new Set(members.map(skillVariant)).size === members.length) grouped.set(slot, members)
  }
  const output: HeroSkillGroup[] = []
  const seen = new Set<number>()
  for (const skill of ordered) {
    const slot = skillSlot(skill)
    const members = slot !== null ? grouped.get(slot) : undefined
    if (members?.includes(skill)) {
      if (!seen.has(slot!)) output.push({ key: `slot:${slot}`, skills: members })
      seen.add(slot!)
    } else output.push({ key: `skill:${skill.skillKey}`, skills: [skill] })
  }
  return output
}

export function skillLabel(skill: Skill) {
  if (skill.kind === "PASSIVE") return "Nội tại"
  const slot = skillSlot(skill)
  if (slot !== null && slot > 0) return `Chiêu ${slot}`
  return skill.kind === "ACTIVE" ? "Chủ động" : "Kỹ năng khác"
}
