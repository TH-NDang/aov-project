/** A skill a trait comes from, with the part of the editor's note about that skill. */
export interface TraitSkillNote {
  skillKey: string
  note: string | null
}

const fold = (value: string) => value.normalize("NFC").toLocaleLowerCase("vi").trim()

/**
 * Splits an editor's trait note into the skills it names. Editors write one part per skill, parted by semicolons, each
 * starting with the skill's name, such as "Dash (6 s cooldown); Storm (50 s cooldown)". Each named part goes
 * to its skill without the name and the brackets around the rest; parts that name no skill stay as the note's rest.
 */
export function traitSkillNotes(
  detail: string | null | undefined,
  skills: readonly { skillKey: string; name?: string | null }[],
): { skills: TraitSkillNote[]; rest: string | null } {
  const notes = new Map(skills.map((skill) => [skill.skillKey, null as string | null]))
  const rest: string[] = []

  for (const part of (detail ?? "").split(";").map((value) => value.trim())) {
    if (!part) continue
    const skill = skills.find((entry) => entry.name && fold(part).startsWith(fold(entry.name)))
    if (!skill?.name || notes.get(skill.skillKey)) {
      rest.push(part)
      continue
    }
    const note = part
      .slice(skill.name.length)
      .trim()
      .replace(/^[:\-–]\s*/u, "")
      .replace(/^\((.*)\)$/u, "$1")
      .trim()
    notes.set(skill.skillKey, note || null)
  }

  return {
    skills: skills.map((skill) => ({ skillKey: skill.skillKey, note: notes.get(skill.skillKey) ?? null })),
    rest: rest.length ? rest.join("; ") : null,
  }
}
