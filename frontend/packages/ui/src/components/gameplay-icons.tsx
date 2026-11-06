import { createArtworkIcon } from "./artwork-icon"

const artwork = new URL("../assets/gameplay-art.svg?no-inline", import.meta.url).href

/**
 * Single-color silhouettes for gameplay concepts: terms, stats and ratings share them so a concept always looks the same.
 * They take the color of the text around them, so a reference can tint one without a second drawing.
 */
export const gameplayIcons = {
  sword: createArtworkIcon(artwork, "sword"),
  orb: createArtworkIcon(artwork, "orb"),
  pierce: createArtworkIcon(artwork, "pierce"),
  shield: createArtworkIcon(artwork, "shield"),
  runeShield: createArtworkIcon(artwork, "rune-shield"),
  heart: createArtworkIcon(artwork, "heart"),
  heal: createArtworkIcon(artwork, "heal"),
  barrier: createArtworkIcon(artwork, "barrier"),
  boot: createArtworkIcon(artwork, "boot"),
  bolt: createArtworkIcon(artwork, "bolt"),
  crit: createArtworkIcon(artwork, "crit"),
  critDamage: createArtworkIcon(artwork, "crit-damage"),
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
  "hoi-mau": "heal",
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

const GLYPH_PREFIX = "glyph:"

/** How a term stores a chosen silhouette in its icon field, next to the URLs of uploaded pictures. */
export const glyphIcon = (name: GameplayIconName) => `${GLYPH_PREFIX}${name}`

export const gameplayIconNames = Object.keys(gameplayIcons) as GameplayIconName[]

function chosenGlyph(icon: string | null | undefined): GameplayIconName | undefined {
  if (!icon?.startsWith(GLYPH_PREFIX)) return undefined
  const name = icon.slice(GLYPH_PREFIX.length)
  return Object.hasOwn(gameplayIcons, name) ? (name as GameplayIconName) : undefined
}

/** A term's own default silhouette, whatever it has chosen since. */
export const defaultTermGlyph = (termId: string): GameplayIconName | undefined => termArtwork[termId]

/** The glyph a term should show: its chosen one, or the default unless it has its own picture. */
export function termGlyphName(term: { id: string; icon?: string | null }): GameplayIconName | undefined {
  return chosenGlyph(term.icon) ?? (term.icon ? undefined : termArtwork[term.id])
}

/** Artwork for a glossary term, or undefined so the caller keeps its own fallback. */
export function termIcon(term: { id: string; icon?: string | null }) {
  const name = termGlyphName(term)
  return name ? gameplayIcons[name] : undefined
}
