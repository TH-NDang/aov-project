import type { HeroLane } from "@aov/ui/components/hero-lane-icon"
import type { Skill } from "./types"

export const positions = {
  top: "Đường Tà thần Caesar",
  mid: "Đường giữa",
  rung: "Rừng",
  "rong-ad": "Đường Rồng",
  "tro-thu": "Hỗ trợ",
} as const
type Position = keyof typeof positions

export const positionLanes: Record<Position, HeroLane> = {
  top: "TOP",
  mid: "MID",
  rung: "JUNGLE",
  "rong-ad": "DRAGON",
  "tro-thu": "SUPPORT",
}

/** Read only captured recommendations; roles alone do not establish a lane. */
export function recommendedHeroPositions(skills: Skill[]): Position[] {
  const found = new Set<Position>()
  for (const skill of skills) {
    for (const effect of skill.effects) {
      if (effect.effectType !== "SOURCE_SNAPSHOT") continue
      const classification = effect.metadata.heroClassification
      if (!classification || typeof classification !== "object") continue
      const values = (classification as Record<string, unknown>).recommendedPositions
      if (!Array.isArray(values)) continue
      for (const value of values)
        if (typeof value === "string" && Object.hasOwn(positions, value)) found.add(value as Position)
    }
  }
  return [...found]
}
