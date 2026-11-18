import { skillSlot, skillVariant } from "./hero-skills"
import { skillImageMatch, type SkillImage } from "../../components/skills/skill-artwork"
import { stateIconsOf } from "../../components/skills/skill-state-icons"
import type { Skill } from "@/lib/hero-types"

/**
 * Library pictures no skill of the draft shows yet: not a skill's own icon, not the picture a skill borrows from the
 * library, not one of its state icons.
 */
export function unusedSkillImages(skills: readonly Skill[], images: readonly SkillImage[]) {
  const borrowed = new Set(
    skills
      .filter((skill) => !skill.iconAssetId)
      .map((skill) => skillImageMatch(skill, images)?.id)
      .filter(Boolean),
  )
  const shown = new Set(
    skills.flatMap((skill) => [skill.iconAssetId, ...stateIconsOf(skill).map((icon) => icon.assetId)]).filter(Boolean),
  )
  return images.filter((image) => !borrowed.has(image.id) && !shown.has(image.assetId))
}

/**
 * Adds a variant to a slot: a skill of its own with its own text, keyed `skill-<slot>-<variant>` so it groups with the
 * slot. It goes right after the slot's other variants, takes the library picture of the same slot and variant when
 * there is one, and may start from a copy of `base`. Returns null when the slot is unknown.
 */
export function addSkillVariant(
  skills: readonly Skill[],
  base: Skill | undefined,
  {
    locale,
    copy = false,
    image,
    slot: requestedSlot,
    library = [],
  }: { locale: string; copy?: boolean; image?: SkillImage; slot?: number; library?: readonly SkillImage[] },
): { skills: Skill[]; added: Skill } | null {
  const slot = image?.sourceSlot ?? requestedSlot ?? (base ? skillSlot(base) : null)
  if (slot === null) return null

  const keys = new Set(skills.map((skill) => skill.skillKey))
  const members = skills.filter((skill) => skillSlot(skill) === slot)
  const taken = new Set(members.map(skillVariant).filter((number): number is number => number !== null))
  const free = (number: number) => !taken.has(number) && !keys.has(`skill-${slot}-${number}`)
  // A slot with no skill starts at 1; a slot whose skills carry no number counts them as variant 1.
  const next = taken.size ? Math.max(...taken) + 1 : members.length ? 2 : 1
  let variant = image && free(image.variantNo) ? image.variantNo : next
  while (!free(variant)) variant++

  const source = copy && base && skillSlot(base) === slot ? base : undefined
  const picture = image ?? library.find((row) => row.sourceSlot === slot && row.variantNo === variant && !row.skillKey)
  const anchor = members.length ? members : base ? [base] : skills
  const after = anchor.length ? Math.max(...anchor.map((skill) => skill.displayOrder)) : -1
  const added: Skill = {
    skillKey: `skill-${slot}-${variant}`,
    kind: members[0]?.kind ?? (slot === 0 ? "PASSIVE" : "ACTIVE"),
    formKey: null,
    displayOrder: after + 1,
    iconAssetId: picture?.assetId ?? null,
    translations: source ? structuredClone(source.translations) : [{ locale, name: "", description: "" }],
    effects: source ? structuredClone(source.effects) : [],
  }
  // Later skills move down one place, so the new variant sits beside the others of its slot.
  const shifted = skills.map((skill) =>
    skill.displayOrder > after ? { ...skill, displayOrder: skill.displayOrder + 1 } : skill,
  )
  return { skills: [...shifted, added], added }
}
