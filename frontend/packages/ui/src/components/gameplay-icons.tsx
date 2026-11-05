import { createArtworkIcon } from "./artwork-icon"

const artwork = new URL("../assets/gameplay-art.svg?no-inline", import.meta.url).href

/** Illustrated glyphs for gameplay concepts: terms, stats and ratings share them so a concept always looks the same. */
export const gameplayIcons = {
  sword: createArtworkIcon(artwork, "sword"),
  orb: createArtworkIcon(artwork, "orb"),
  pierce: createArtworkIcon(artwork, "pierce"),
  shield: createArtworkIcon(artwork, "shield"),
  runeShield: createArtworkIcon(artwork, "rune-shield"),
  heart: createArtworkIcon(artwork, "heart"),
  barrier: createArtworkIcon(artwork, "barrier"),
  boot: createArtworkIcon(artwork, "boot"),
  bolt: createArtworkIcon(artwork, "bolt"),
  crit: createArtworkIcon(artwork, "crit"),
  slow: createArtworkIcon(artwork, "slow"),
  stun: createArtworkIcon(artwork, "stun"),
  cooldown: createArtworkIcon(artwork, "cooldown"),
  rune: createArtworkIcon(artwork, "rune"),
  table: createArtworkIcon(artwork, "table"),
  flame: createArtworkIcon(artwork, "flame"),
  coin: createArtworkIcon(artwork, "coin"),
  mana: createArtworkIcon(artwork, "mana"),
  vamp: createArtworkIcon(artwork, "vamp"),
}

export type GameplayIconName = keyof typeof gameplayIcons

const termArtwork: Record<string, GameplayIconName> = {
  "sat-thuong-vat-ly": "sword",
  "cong-vat-ly": "sword",
  "sat-thuong-phep": "orb",
  "cong-phep": "orb",
  "sat-thuong-chuan": "pierce",
  giap: "shield",
  "giap-phep": "runeShield",
  "hoi-mau": "heart",
  "la-chan": "barrier",
  "toc-chay": "boot",
  "toc-danh": "bolt",
  "chi-mang": "crit",
  "lam-cham": "slow",
  choang: "stun",
  "giam-hoi-chieu": "cooldown",
  "noi-tai": "rune",
  "thong-so-theo-cap-chieu": "table",
}

/** Artwork for a glossary term, or undefined so the caller keeps its own fallback. */
export function termIcon(termId: string) {
  const name = termArtwork[termId]
  return name ? gameplayIcons[name] : undefined
}
