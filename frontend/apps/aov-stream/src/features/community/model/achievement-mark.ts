import { compareAchievementRanks, type AchievementRank } from "@aov/community-contracts/achievements"

/** What the mark beside a competition's results shows: a cup for the title, the place, or the sign of an award. */
export type AchievementMark = { kind: "champion" } | { kind: "place"; text: string } | { kind: "award" }

/** The mark of a competition's results, from the best of their ranks. */
export function achievementMark(ranks: AchievementRank[]): AchievementMark {
  const best = [...ranks].sort(compareAchievementRanks)[0]
  if (!best || best === "AWARD") return { kind: "award" }
  if (best.place === 1 && best.placeTo == null) return { kind: "champion" }
  return { kind: "place", text: best.placeTo ? `${best.place}–${best.placeTo}` : String(best.place) }
}
