import "./hero-glyph.css"

export type HeroGlyphName =
  | "top"
  | "jungle"
  | "mid"
  | "dragon"
  | "roam"
  | "tank"
  | "warrior"
  | "assassin"
  | "mage"
  | "marksman"
  | "support"
  | "easy"
  | "medium"
  | "hard"
  | "changed"

/** The game's mark for a lane or a role, or the library's mark for a difficulty or a change, in the text's colour. */
export function HeroGlyph({ name, className = "" }: { name: HeroGlyphName; className?: string }) {
  const source = `url("/icons/hero/${name}.svg")`
  return (
    <span
      className={`wiki-hero-glyph ${className}`}
      style={{ maskImage: source, WebkitMaskImage: source }}
      aria-hidden="true"
    />
  )
}
