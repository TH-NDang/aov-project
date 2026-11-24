import { wikiText } from "../../../context/wiki-context"
import type { PublicSkill } from "../../../lib/hero-api"

/** Where a skill sits in the kit, as the game names it: Passive, Ability 1, Ability 2… */
export function skillLabel(skill: PublicSkill, locale: string) {
  if (skill.kind === "PASSIVE") return wikiText(locale, "Nội tại", "Passive")
  const source = skill.effects?.find((effect) => effect.effectType === "SOURCE_SNAPSHOT")?.metadata?.sourceSlot
  const slot = typeof source === "number" ? source : /^skill_(\d+)$/.exec(String(source))?.[1]
  const number = slot ?? /^(?:skill|capture-skill)-(\d+)(?:-\d+)?$/.exec(skill.skillKey)?.[1]
  return Number(number) > 0
    ? `${wikiText(locale, "Chiêu", "Ability")} ${number}`
    : wikiText(locale, "Kỹ năng", "Ability")
}
