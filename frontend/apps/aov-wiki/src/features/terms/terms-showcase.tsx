import type { CSSProperties } from "react"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { termIcon } from "@aov/ui/components/gameplay-icons"
import { defaultEntityColor, type EntityReference } from "@aov/ui/lib/entity-rich-text"
import { CatalogShowcase } from "../../components/catalog-showcase"
import { useWikiText } from "../../context/wiki-context"
import "./terms-showcase.css"

/**
 * Where the seals stand, as shares of the banner, and how near each is: near seals are large and sharp, far ones small
 * and soft. The middle is left open for the title.
 */
const PLACES: { x: number; y: number; depth: "near" | "mid" | "far" }[] = [
  { x: 5, y: 26, depth: "mid" },
  { x: 13, y: 68, depth: "near" },
  { x: 20, y: 14, depth: "far" },
  { x: 25, y: 44, depth: "mid" },
  { x: 30, y: 82, depth: "far" },
  { x: 35, y: 20, depth: "far" },
  { x: 4, y: 84, depth: "far" },
  { x: 66, y: 16, depth: "far" },
  { x: 70, y: 64, depth: "mid" },
  { x: 77, y: 30, depth: "near" },
  { x: 85, y: 78, depth: "mid" },
  { x: 91, y: 40, depth: "far" },
  { x: 95, y: 12, depth: "mid" },
  { x: 64, y: 86, depth: "far" },
  { x: 97, y: 74, depth: "far" },
  { x: 81, y: 6, depth: "far" },
]

/**
 * The head of the glossary: its title and the number of terms in the middle, and around them the terms' own glyphs,
 * each on a round seal tinted with its colour, scattered at different depths like a sky of signs that drifts gently.
 * While the glossary loads the head has its text only.
 */
export function TermsShowcase({ terms }: { terms?: readonly EntityReference[] }) {
  const text = useWikiText()
  const wide = usePageLayout() === "wide"
  const count = terms?.length
  const seals = (terms ?? []).flatMap((entity) => {
    const Glyph = termIcon(entity)
    return Glyph ? [{ id: entity.id, Glyph, color: entity.display?.color ?? defaultEntityColor(entity) }] : []
  })
  return (
    <CatalogShowcase
      title={text("Thuật ngữ", "Glossary")}
      count={count ? text(`${count} thuật ngữ`, count === 1 ? "1 term" : `${count} terms`) : undefined}
      wide={wide}
      align="center"
      scene={
        seals.length > 0 && (
          <div className="wiki-terms-sky">
            {PLACES.map((place, index) => {
              const seal = seals[index % seals.length]!
              return (
                <span
                  key={index}
                  className="wiki-terms-seal"
                  data-depth={place.depth}
                  style={
                    {
                      "--term-color": seal.color,
                      "--x": `${place.x}%`,
                      "--y": `${place.y}%`,
                      "--float": (index * 7) % 11,
                    } as CSSProperties
                  }
                >
                  <seal.Glyph size={28} />
                </span>
              )
            })}
          </div>
        )
      }
    />
  )
}
