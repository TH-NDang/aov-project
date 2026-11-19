import type { ProfileAchievement } from "@aov/community-contracts"

type Rank = Pick<ProfileAchievement, "place" | "placeTo" | "award">

/** The ranks an editor picks most, then another place typed in, an individual award, or none. */
export type RankChoice = "" | "1" | "2" | "3" | "4" | "3-4" | "5-8" | "OTHER" | "AWARD"

export const RANK_CHOICES: { value: RankChoice; label: string }[] = [
  { value: "", label: "Chưa chọn" },
  { value: "1", label: "Vô địch" },
  { value: "2", label: "Á quân" },
  { value: "3", label: "Hạng 3" },
  { value: "4", label: "Hạng 4" },
  { value: "3-4", label: "Đồng hạng 3–4" },
  { value: "5-8", label: "Đồng hạng 5–8" },
  { value: "OTHER", label: "Hạng khác" },
  { value: "AWARD", label: "Giải thưởng cá nhân" },
]

const PRESETS: Partial<Record<RankChoice, Rank>> = {
  "1": { place: 1, placeTo: null },
  "2": { place: 2, placeTo: null },
  "3": { place: 3, placeTo: null },
  "4": { place: 4, placeTo: null },
  "3-4": { place: 3, placeTo: 4 },
  "5-8": { place: 5, placeTo: 8 },
}

/** The choice that shows a stored rank; a place no preset names is another place. */
export function rankChoice(item: Rank): RankChoice {
  if (item.award) return "AWARD"
  if (item.place == null) return ""
  const preset = Object.entries(PRESETS).find(
    ([, rank]) => rank.place === item.place && (rank.placeTo ?? null) === (item.placeTo ?? null),
  )
  return preset ? (preset[0] as RankChoice) : "OTHER"
}

/** The rank fields a choice writes. Another place keeps the place already typed in. */
export function chooseRank(choice: RankChoice, item: Rank): Required<Rank> {
  if (choice === "AWARD") return { place: null, placeTo: null, award: true }
  if (choice === "OTHER") return { place: item.place ?? null, placeTo: item.placeTo ?? null, award: null }
  const preset = PRESETS[choice]
  return { place: preset?.place ?? null, placeTo: preset?.placeTo ?? null, award: null }
}

/** A typed place: a whole number from 1, or nothing while the box is empty. */
export function typedPlace(value: string): number | null {
  const place = Number.parseInt(value, 10)
  return Number.isFinite(place) && place >= 1 ? place : null
}
