/**
 * The colors a hero page takes from the hero's artwork. Only an overlay on that artwork uses them (the quick switch
 * button sits on the splash art), which AGENTS.md allows; everything else on the page reads the shared tokens.
 */
export interface HeroAppearance {
  accent: string
}

const DEFAULT_APPEARANCE: HeroAppearance = { accent: "#d5cfbf" }

// Editorial palettes follow the current artwork and can later move into published media metadata.
const ARTWORK_APPEARANCES: Readonly<Record<string, HeroAppearance>> = {
  aleister: { accent: "#b3ccd9" },
  amily: { accent: "#e4b79e" },
  ata: { accent: "#a8d4ce" },
  baldum: { accent: "#bfd29e" },
  celica: { accent: "#b1cdd0" },
  "d-arcy": { accent: "#a8c9e2" },
  dirak: { accent: "#e4ce94" },
  "eland-orr": { accent: "#aeced3" },
  errol: { accent: "#a7c8d4" },
  flowborn: { accent: "#b6d8e1" },
  "flowborn-ad": { accent: "#b6d8e1" },
  gildur: { accent: "#dfca9e" },
  hayate: { accent: "#c6bfd4" },
  kriknak: { accent: "#b8bfdd" },
  krizzix: { accent: "#cad4a3" },
  lauriel: { accent: "#ded5b7" },
  natalya: { accent: "#a8cbd8" },
  raz: { accent: "#e2b39b" },
  roxie: { accent: "#e1c5a1" },
  ryoma: { accent: "#ddc4a4" },
  toro: { accent: "#d9c9ae" },
  volkath: { accent: "#d7b1c4" },
  wukong: { accent: "#e1c68f" },
  yorn: { accent: "#e0c294" },
  zanis: { accent: "#bfc2df" },
}

export function heroAppearance(heroCode: string): HeroAppearance {
  return ARTWORK_APPEARANCES[heroCode] ?? DEFAULT_APPEARANCE
}
