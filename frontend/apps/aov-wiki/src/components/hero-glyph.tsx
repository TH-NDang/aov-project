import "./hero-glyph.css"

export type HeroGlyphName =
  "top" | "jungle" | "mid" | "dragon" | "roam" | "tank" | "warrior" | "assassin" | "mage" | "marksman" | "support"

/** The game's mark for a lane or a role, drawn in the colour of the text around it. */
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
