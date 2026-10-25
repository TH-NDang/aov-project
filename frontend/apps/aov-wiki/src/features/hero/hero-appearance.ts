export interface HeroAppearance {
  surfaceRgb: string
  backdrop: string
  accent: string
}

const DEFAULT_APPEARANCE: HeroAppearance = {
  surfaceRgb: "43, 49, 61",
  backdrop: "#1c222c",
  accent: "#d5cfbf",
}

// Editorial palettes follow the current artwork and can later move into published media metadata.
const ARTWORK_APPEARANCES: Readonly<Record<string, HeroAppearance>> = {
  aleister: { surfaceRgb: "39, 45, 65", backdrop: "#191b2b", accent: "#b3ccd9" },
  amily: { surfaceRgb: "61, 40, 41", backdrop: "#291d22", accent: "#e4b79e" },
  ata: { surfaceRgb: "31, 57, 60", backdrop: "#172a2e", accent: "#a8d4ce" },
  baldum: { surfaceRgb: "34, 55, 43", backdrop: "#192a23", accent: "#bfd29e" },
  celica: { surfaceRgb: "36, 51, 60", backdrop: "#19262b", accent: "#b1cdd0" },
  "d-arcy": { surfaceRgb: "30, 48, 70", backdrop: "#182536", accent: "#a8c9e2" },
  dirak: { surfaceRgb: "65, 50, 31", backdrop: "#2c2419", accent: "#e4ce94" },
  "eland-orr": { surfaceRgb: "35, 53, 65", backdrop: "#1a2831", accent: "#aeced3" },
  errol: { surfaceRgb: "32, 51, 62", backdrop: "#192730", accent: "#a7c8d4" },
  "flowborn-ad": { surfaceRgb: "33, 55, 66", backdrop: "#1b2b33", accent: "#b6d8e1" },
  gildur: { surfaceRgb: "45, 49, 67", backdrop: "#202431", accent: "#dfca9e" },
  hayate: { surfaceRgb: "47, 48, 63", backdrop: "#222330", accent: "#c6bfd4" },
  kriknak: { surfaceRgb: "36, 45, 67", backdrop: "#1c2232", accent: "#b8bfdd" },
  krizzix: { surfaceRgb: "43, 56, 37", backdrop: "#202b21", accent: "#cad4a3" },
  lauriel: { surfaceRgb: "45, 57, 70", backdrop: "#222b34", accent: "#ded5b7" },
  natalya: { surfaceRgb: "31, 49, 62", backdrop: "#182631", accent: "#a8cbd8" },
  raz: { surfaceRgb: "65, 39, 35", backdrop: "#2b1c1c", accent: "#e2b39b" },
  roxie: { surfaceRgb: "62, 47, 36", backdrop: "#2b221d", accent: "#e1c5a1" },
  ryoma: { surfaceRgb: "62, 49, 40", backdrop: "#2a231e", accent: "#ddc4a4" },
  toro: { surfaceRgb: "40, 52, 64", backdrop: "#1e2731", accent: "#d9c9ae" },
  volkath: { surfaceRgb: "57, 39, 53", backdrop: "#281d28", accent: "#d7b1c4" },
  wukong: { surfaceRgb: "64, 51, 35", backdrop: "#2b251c", accent: "#e1c68f" },
  yorn: { surfaceRgb: "63, 48, 35", backdrop: "#2c231c", accent: "#e0c294" },
  zanis: { surfaceRgb: "43, 44, 68", backdrop: "#202135", accent: "#bfc2df" },
}

export function heroAppearance(heroCode: string): HeroAppearance {
  return ARTWORK_APPEARANCES[heroCode] ?? DEFAULT_APPEARANCE
}
