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

const ENGLISH_LABELS: Record<HeroRole | HeroPosition, string> = {
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
}

export function localizedHeroOptions<Value extends HeroRole | HeroPosition>(
  options: readonly HeroFilterOption<Value>[],
  locale: string,
): readonly HeroFilterOption<Value>[] {
  return locale.startsWith("en")
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
