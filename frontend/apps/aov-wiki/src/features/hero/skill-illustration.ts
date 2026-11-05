import type { PublicSkill } from "./hero-api"

export function skillIllustration(code: string, skill: PublicSkill) {
  const match = /^skill-(\d+)-([1-9]\d*)$/.exec(skill.skillKey)
  if (!match || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)) return null
  for (const { effectType, metadata } of skill.effects ?? []) {
    if (effectType !== "SOURCE_SNAPSHOT" || !metadata) continue
    if (metadata.sourceHeroCode && metadata.sourceHeroCode !== code) return null
    if (
      [metadata.reviewFlags, metadata.heroReviewFlags].some(
        (flags) => Array.isArray(flags) && flags.some((flag) => flag?.type === "source_filename_display_mismatch"),
      )
    )
      return null
  }
  return `/skill-artwork/${code}-${match[1]}-${match[2]}.png`
}
