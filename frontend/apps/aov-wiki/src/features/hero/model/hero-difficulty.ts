/**
 * Where a difficulty rating falls on the five words a reader is given, from 1 (very easy) to 5 (very hard), whatever
 * scale the rating was recorded on. A half step rounds up, to the harder word.
 */
export function difficultyLevel(value: number, maximum: number) {
  return Math.min(5, Math.max(1, Math.round((value / maximum) * 5)))
}

/** The five words of difficulty, from very easy to very hard, in Vietnamese and in English. */
export const DIFFICULTY_WORDS = [
  ["Rất dễ", "Very easy"],
  ["Dễ", "Easy"],
  ["Trung bình", "Medium"],
  ["Khó", "Hard"],
  ["Rất khó", "Very hard"],
] as const

/** The three bands the library filters and groups by: the two easy words, the middle one, the two hard words. */
export type DifficultyBand = "easy" | "medium" | "hard"

/** The name of each band, in Vietnamese and in English. */
export const DIFFICULTY_BAND_WORDS: Record<DifficultyBand, readonly [string, string]> = {
  easy: ["Dễ", "Easy"],
  medium: ["Trung bình", "Medium"],
  hard: ["Khó", "Hard"],
}

export function difficultyBand(level: number): DifficultyBand {
  return level <= 2 ? "easy" : level === 3 ? "medium" : "hard"
}
