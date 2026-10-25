import type { HeroGlyphName } from "./hero-glyph"

export type HeroRole = "TANK" | "WARRIOR" | "ASSASSIN" | "MAGE" | "MARKSMAN" | "SUPPORT"
export type HeroPosition = "TOP" | "JUNGLE" | "MID" | "DRAGON" | "ROAM"

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
  { value: "ROAM", label: "Hỗ trợ", glyph: "roam" },
]

// These provisional assignments demonstrate position filters until editors provide the catalog data.
const REFERENCE_POSITIONS: Readonly<Record<string, readonly HeroPosition[]>> = {
  aleister: ["MID"],
  amily: ["TOP", "JUNGLE"],
  ata: ["TOP", "ROAM"],
  baldum: ["ROAM"],
  celica: ["DRAGON"],
  "d-arcy": ["MID", "JUNGLE"],
  dirak: ["MID"],
  "eland-orr": ["JUNGLE"],
  errol: ["TOP", "JUNGLE"],
  "flowborn-ad": ["DRAGON"],
  gildur: ["MID", "ROAM"],
  hayate: ["DRAGON"],
  kriknak: ["JUNGLE"],
  krizzix: ["ROAM"],
  lauriel: ["MID"],
  natalya: ["MID"],
  raz: ["MID"],
  roxie: ["TOP"],
  ryoma: ["TOP", "JUNGLE"],
  toro: ["ROAM"],
  volkath: ["TOP", "JUNGLE"],
  wukong: ["TOP", "JUNGLE"],
  yorn: ["DRAGON"],
  zanis: ["JUNGLE"],
}

export function referencePositions(heroCode: string): readonly HeroPosition[] {
  return REFERENCE_POSITIONS[heroCode] || []
}

export function normalizedHeroSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLocaleLowerCase("vi-VN")
    .trim()
}

export function selectedHeroFilters<Value extends string>(
  query: string | null,
  options: readonly HeroFilterOption<Value>[],
) {
  const selected = new Set((query || "").split(",").map((value) => value.trim().toUpperCase()))
  return options.filter((option) => selected.has(option.value)).map((option) => option.value)
}
