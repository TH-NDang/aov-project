import { skillSlot, type RankSkill } from "./skill-rank-values"
import { referenceInputPlainText } from "./reference-input-dom"

/** What both the admin and the public skill records carry for laying out a hero's kit. */
export interface KitSkill extends RankSkill {
  displayOrder: number
  formKey?: string | null
}

export interface SkillKitGroup<T extends KitSkill> {
  key: string
  slot: number | null
  skills: T[]
}

/** The variant number of a `skill-<slot>-<variant>` key, when it belongs to the skill's own slot. */
export function skillVariantNo(skill: KitSkill): number | null {
  const match = /^skill-(\d+)-(\d+)$/.exec(skill.skillKey)
  return match && skillSlot(skill) === Number(match[1]) ? Number(match[2]) : null
}

/**
 * Groups the variants of a slot (forms, enhanced versions, second casts) into one entry of the kit, in display order.
 * Only explicit slot/variant keys are grouped; a skill with any other key stays an entry of its own.
 */
export function groupSkillKit<T extends KitSkill>(skills: readonly T[]): SkillKitGroup<T>[] {
  const ordered = [...skills].sort((a, b) => a.displayOrder - b.displayOrder)
  const slots = new Map<number, T[]>()
  for (const skill of ordered) {
    const slot = skillSlot(skill)
    if (slot === null || skillVariantNo(skill) === null) continue
    slots.set(slot, [...(slots.get(slot) ?? []), skill])
  }
  const grouped = new Map<number, T[]>()
  for (const [slot, members] of slots) {
    if (members.length > 1 && new Set(members.map(skillVariantNo)).size === members.length) grouped.set(slot, members)
  }
  const output: SkillKitGroup<T>[] = []
  const seen = new Set<number>()
  for (const skill of ordered) {
    const slot = skillSlot(skill)
    const members = slot !== null ? grouped.get(slot) : undefined
    if (members?.includes(skill)) {
      if (!seen.has(slot!)) output.push({ key: `slot:${slot}`, slot, skills: members })
      seen.add(slot!)
    } else output.push({ key: `skill:${skill.skillKey}`, slot, skills: [skill] })
  }
  return output
}

/** How a variant is named in a switch: its form name, otherwise its number. */
export function skillFormName(skill: KitSkill, numbered: (variant: number) => string = (n) => `Biến thể ${n}`) {
  const form = skill.formKey?.trim()
  if (form) return form
  const variant = skillVariantNo(skill)
  return variant === null ? "" : numbered(variant)
}

const plain = (value: unknown) => {
  const text = String(value ?? "").trim()
  return text.includes("<") ? referenceInputPlainText(text) : text
}

/**
 * The cooldown from the first to the last rank, read from the skill's level table ("10s → 8s"), or null when the
 * table has no cooldown row with numbers. A single value is returned once when every rank has the same cooldown.
 */
export function skillCooldownRange(skill: RankSkill): string | null {
  const source = skill.effects?.find((effect) => effect.effectType === "SOURCE_SNAPSHOT")?.metadata
  const table = source?.levelTable as { rows?: { label?: unknown; display_values?: unknown[] }[] } | undefined
  const row = table?.rows?.find((entry) => /hồi chiêu|h\.\s*chiêu|cooldown/i.test(plain(entry?.label)))
  const values = (row?.display_values ?? [])
    .map((value) => plain(value).replace(/\s*(?:s|giây)$/i, ""))
    .filter((value) => /^\d+(?:[.,]\d+)?$/.test(value))
  if (!values.length) return null
  const first = values[0]!
  const last = values.at(-1)!
  return first === last ? `${first}s` : `${first}s → ${last}s`
}
