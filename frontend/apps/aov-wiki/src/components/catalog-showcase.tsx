import type { ReactNode } from "react"
import "./catalog-showcase.css"

/** What the head of a catalog page says, and where it stands. */
export interface ShowcaseIntro {
  title: string
  /** The number of entries with its unit; left out while the catalog loads. */
  count?: string
  /** A control pinned to the banner, such as the data version: its top right corner on wide screens, beside the count on phones. */
  corner?: ReactNode
  wide: boolean
}

/**
 * Where the title stands on a wide banner, so each page can compose its scene around it: beside the middle of the left
 * edge, in the top or bottom left corner, or in the centre with the scene around it. Phones always set it at the foot.
 */
export type ShowcaseAlign = "middle" | "top" | "bottom" | "center"

/**
 * The head of a catalog page (the heroes, the skins, the armory parts, the patch notes, the glossary): its title and
 * count over a scene drawn from the page's own pictures. Every scene covers the whole banner, behind the text too, under
 * a shade that follows where the text stands; each page composes its own. On wide screens it is a framed banner. On
 * phones it runs edge to edge under the clear header, which names the page and frosts over the scene as the page
 * scrolls. `note` is a line about the scene, at the banner's foot on the right, on wide screens only.
 */
export function CatalogShowcase({
  title,
  count,
  corner,
  wide,
  scene,
  align = "middle",
  note,
}: ShowcaseIntro & { scene?: ReactNode; align?: ShowcaseAlign; note?: ReactNode }) {
  const counted = count && <span className="wiki-catalog-showcase-count">{count}</span>
  return (
    <section className="wiki-catalog-showcase" data-layout={wide ? "wide" : "compact"} data-align={align}>
      <div className="wiki-catalog-showcase-scene" aria-hidden="true">
        {scene}
      </div>
      <div className="wiki-catalog-showcase-text">
        {wide ? (
          <div className="wiki-catalog-showcase-title">
            <h1>{title}</h1>
            {counted}
          </div>
        ) : (
          <div className="wiki-catalog-showcase-meta">
            {counted}
            {corner}
          </div>
        )}
      </div>
      {wide && corner && <div className="wiki-catalog-showcase-corner">{corner}</div>}
      {wide && note && <div className="wiki-catalog-showcase-note">{note}</div>}
    </section>
  )
}
