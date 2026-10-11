import type { Hero } from "../../lib/api/types"

export type Mechanic = "hero-form" | "skill-variant" | "none"
export type HeroReview = "portrait" | "skins" | "skills" | "ready"
export const MECHANIC_LABEL: Record<Mechanic, string> = {
  "hero-form": "Đổi dạng tướng",
  "skill-variant": "Biến thể chiêu",
  none: "Thường",
}

export interface HeroRow {
  hero: Hero
  skins: number
  missingPortraits: number
  skills: number
  missingDescriptions: number
  icons: number
  expectedIcons: number
  mechanic: Mechanic
  portrait: "ok" | "missing"
  review: HeroReview[]
}

export function toHeroRow(hero: Hero): HeroRow {
  const skins = hero.skins.filter((skin) => !skin.isDefault)
  const missingPortraits = skins.filter((skin) => !skin.portrait).length
  const variants = hero.skills.flatMap((skill) => skill.variants)
  const icons = variants.filter((variant) => variant.icon).length
  const missingDescriptions = hero.skills.filter((skill) => !skill.description?.trim()).length
  const review: HeroReview[] = []
  if (!hero.portrait) review.push("portrait")
  if (missingPortraits) review.push("skins")
  if (
    !hero.skills.length ||
    missingDescriptions ||
    icons < variants.length ||
    hero.skills.some((skill) => !skill.variants.length)
  )
    review.push("skills")
  return {
    hero,
    skins: skins.length,
    missingPortraits,
    skills: hero.skills.length,
    missingDescriptions,
    icons,
    expectedIcons: variants.length,
    mechanic: hero.forms.length
      ? "hero-form"
      : hero.skills.some((skill) => skill.switchMode === "skill-variant")
        ? "skill-variant"
        : "none",
    portrait: hero.portrait ? "ok" : "missing",
    review: review.length ? review : ["ready"],
  }
}
