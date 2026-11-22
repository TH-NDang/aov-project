import type { ReactNode } from "react"
import "./catalog-showcase.css"

/** What the head of a catalog page says, and where it stands. */
export interface ShowcaseIntro {
  title: string
  /** Left out where the scene speaks for the page. */
  tagline?: string
  lead?: string
  /** The number of entries with its unit; left out while the catalog loads. */
  count?: string
  /** The data version, under the text on wide screens; phones show it below the filters. */
  action?: ReactNode
  wide: boolean
}

/**
 * The head of a catalog page (the armory parts, the heroes): its tagline and plain line, its count, and a scene drawn
 * from its own pictures. On wide screens it is a framed banner with the title and the data version beside the scene.
 * On phones it runs edge to edge under the clear header, which names the page and frosts over the scene as the page
 * scrolls. Each page brings a scene of its own and a caption about it. `fill` spreads the scene over the whole banner,
 * behind the text too, with a shade that keeps the text clear. `corner` pins a control to the banner: its top right
 * corner on wide screens, beside the count on phones.
 */
export function CatalogShowcase({
  title,
  tagline,
  lead,
  count,
  action,
  wide,
  scene,
  caption,
  fill = false,
  corner,
}: ShowcaseIntro & { scene?: ReactNode; caption?: ReactNode; fill?: boolean; corner?: ReactNode }) {
  const counted = count && <span className="wiki-catalog-showcase-count">{count}</span>
  return (
    <section className="wiki-catalog-showcase" data-layout={wide ? "wide" : "compact"} data-fill={fill || undefined}>
      <div className="wiki-catalog-showcase-scene" aria-hidden="true">
        {scene}
      </div>
      <div className="wiki-catalog-showcase-text">
        {wide ? (
          <div className="wiki-catalog-showcase-title">
            <h1>{title}</h1>
            {counted}
          </div>
        ) : corner ? (
          <div className="wiki-catalog-showcase-meta">
            {counted}
            {corner}
          </div>
        ) : (
          counted
        )}
        {tagline && <p className="wiki-catalog-showcase-tagline">{tagline}</p>}
        {lead && <p>{lead}</p>}
        {caption}
        {wide && action}
      </div>
      {wide && corner && <div className="wiki-catalog-showcase-corner">{corner}</div>}
    </section>
  )
}
