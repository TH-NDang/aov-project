import { isEnglishLocale } from "@aov/ui/lib/locale-text"
import type { HeroGlyphName } from "../components/hero-glyph"
import { foldSearchText } from "@aov/ui/lib/search-text"

export type HeroRole = "TANK" | "WARRIOR" | "ASSASSIN" | "MAGE" | "MARKSMAN" | "SUPPORT"
export type HeroPosition = "TOP" | "JUNGLE" | "MID" | "DRAGON" | "SUPPORT"

export interface HeroFilterOption<Value extends string> {
  value: Value
  label: string
  glyph: HeroGlyphName
}

export const HERO_ROLES: readonly HeroFilterOption<HeroRole>[] = [
  { value: "TANK", label: "Đỡ đòn", glyph: "tank" },
  { value: "WARRIOR", label: "Đấu sĩ", glyph: "warrior" },
  { value: "ASSASSIN", label: "Sát thủ", glyph: "assassin" },
  { value: "MAGE", label: "Pháp sư", glyph: "mage" },
  { value: "MARKSMAN", label: "Xạ thủ", glyph: "marksman" },
  { value: "SUPPORT", label: "Trợ thủ", glyph: "support" },
]

export const HERO_POSITIONS: readonly HeroFilterOption<HeroPosition>[] = [
  { value: "TOP", label: "Đường Caesar", glyph: "top" },
  { value: "JUNGLE", label: "Rừng", glyph: "jungle" },
  { value: "MID", label: "Đường giữa", glyph: "mid" },
  { value: "DRAGON", label: "Đường Rồng", glyph: "dragon" },
  { value: "SUPPORT", label: "Hỗ trợ", glyph: "roam" },
]

/** How hard a hero is to play, in the three bands the library filters by. */
export type HeroDifficulty = "EASY" | "MEDIUM" | "HARD"

export const HERO_DIFFICULTIES: readonly HeroFilterOption<HeroDifficulty>[] = [
  { value: "EASY", label: "Dễ", glyph: "easy" },
  { value: "MEDIUM", label: "Trung bình", glyph: "medium" },
  { value: "HARD", label: "Khó", glyph: "hard" },
]

/** The one choice that keeps the heroes the selected version changed. */
export type HeroChange = "CHANGED"

export const HERO_CHANGE: readonly HeroFilterOption<HeroChange>[] = [
  { value: "CHANGED", label: "Đổi ở bản này", glyph: "changed" },
]

const ENGLISH_LABELS: Record<HeroRole | HeroPosition | HeroDifficulty | HeroChange, string> = {
  TANK: "Tank",
  WARRIOR: "Warrior",
  ASSASSIN: "Assassin",
  MAGE: "Mage",
  MARKSMAN: "Marksman",
  SUPPORT: "Support",
  TOP: "Dark Slayer lane",
  JUNGLE: "Jungle",
  MID: "Mid lane",
  DRAGON: "Abyssal Dragon lane",
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
  CHANGED: "Changed in this version",
}

export function localizedHeroOptions<Value extends HeroRole | HeroPosition | HeroDifficulty | HeroChange>(
  options: readonly HeroFilterOption<Value>[],
  locale: string,
): readonly HeroFilterOption<Value>[] {
  return isEnglishLocale(locale)
    ? options.map((option) => ({ ...option, label: ENGLISH_LABELS[option.value] }))
    : options
}

export function normalizedHeroSearch(value: string) {
  return foldSearchText(value).trim()
}

export function selectedHeroFilters<Value extends string>(
  query: string | null,
  options: readonly HeroFilterOption<Value>[],
) {
  const selected = new Set((query || "").split(",").map((value) => value.trim().toUpperCase()))
  return options.filter((option) => selected.has(option.value)).map((option) => option.value)
}
