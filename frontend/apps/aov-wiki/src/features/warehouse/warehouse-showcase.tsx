import type { ReactNode } from "react"
import "./warehouse-showcase.css"

/** What the head of an armory page says, and where it stands. */
export interface ShowcaseIntro {
  title: string
  tagline: string
  lead: string
  /** The number of entries with its unit; left out while the catalog loads. */
  count?: string
  /** The data version, under the text on wide screens; phones show it below the filters. */
  action?: ReactNode
  wide: boolean
}

/**
 * The head of an armory page: the part's tagline and plain line, its count, and a scene drawn from its own pictures.
 * On wide screens it is a framed banner with the title and the data version beside the scene. On phones it runs edge
 * to edge under the clear header, which names the part and frosts over the scene as the page scrolls. Each part
 * brings a scene of its own and a caption about it.
 */
export function WarehouseShowcase({
  title,
  tagline,
  lead,
  count,
  action,
  wide,
  scene,
  caption,
}: ShowcaseIntro & { scene?: ReactNode; caption?: ReactNode }) {
  const counted = count && <span className="wiki-warehouse-showcase-count">{count}</span>
  return (
    <section className="wiki-warehouse-showcase" data-layout={wide ? "wide" : "compact"}>
      <div className="wiki-warehouse-showcase-scene" aria-hidden="true">
        {scene}
      </div>
      <div className="wiki-warehouse-showcase-text">
        {wide ? (
          <div className="wiki-warehouse-showcase-title">
            <h1>{title}</h1>
            {counted}
          </div>
        ) : (
          counted
        )}
        <p className="wiki-warehouse-showcase-tagline">{tagline}</p>
        <p>{lead}</p>
        {caption}
        {wide && action}
      </div>
    </section>
  )
}
