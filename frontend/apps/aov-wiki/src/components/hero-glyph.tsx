import { HeroMark, type HeroMarkName } from "@aov/ui/components/hero-marks"
import "./hero-glyph.css"

export type HeroGlyphName = HeroMarkName

/** The game's mark for a lane or a role, or the library's mark for a difficulty or a change, in the text's colour. */
export function HeroGlyph({ name, className = "" }: { name: HeroGlyphName; className?: string }) {
  return <HeroMark name={name} className={`wiki-hero-glyph ${className}`} />
}
