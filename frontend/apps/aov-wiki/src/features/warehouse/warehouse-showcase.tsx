import type { CSSProperties, ReactNode } from "react"
import { warehouseImage, type PublishedWarehouseRecord } from "../../lib/warehouse-types"
import "./warehouse-showcase.css"

/**
 * Where the pictures stand on the display, front first: one large piece in the middle, two at its sides a little
 * turned, and smaller ones further back. Positions are shares of the scene, sizes are pixels.
 */
const SLOTS_COMPACT = [
  { x: 78, y: 54, size: 70, turn: 0, depth: 0 },
  { x: 64, y: 66, size: 46, turn: -9, depth: 1 },
  { x: 93, y: 66, size: 46, turn: 9, depth: 1 },
  { x: 68, y: 22, size: 34, turn: -5, depth: 2 },
  { x: 88, y: 20, size: 34, turn: 6, depth: 2 },
  { x: 57, y: 34, size: 26, turn: -12, depth: 3 },
  { x: 101, y: 38, size: 26, turn: 12, depth: 3 },
] as const
/** A wide banner gives the display the width of its scene: the same pieces, set further apart. */
const SLOTS_WIDE = [
  { x: 52, y: 54, size: 72, turn: 0, depth: 0 },
  { x: 33, y: 62, size: 50, turn: -9, depth: 1 },
  { x: 71, y: 62, size: 50, turn: 9, depth: 1 },
  { x: 42, y: 22, size: 36, turn: -5, depth: 2 },
  { x: 62, y: 20, size: 36, turn: 6, depth: 2 },
  { x: 17, y: 34, size: 28, turn: -12, depth: 3 },
  { x: 87, y: 34, size: 28, turn: 12, depth: 3 },
] as const

/**
 * A few pictures of the part: from its highest tier when that tier fills the display, so it shows finished pieces,
 * picked evenly across the catalog's order, so one group (one arcana colour, one branch) does not fill it.
 */
export function showcaseImages(entries: PublishedWarehouseRecord[], count = SLOTS_COMPACT.length) {
  const pictured = entries.flatMap((entry) => {
    const url = warehouseImage(entry)
    return url ? [{ url, tier: "tier" in entry.content ? (entry.content.tier ?? 0) : 0 }] : []
  })
  const highest = Math.max(0, ...pictured.map((picture) => picture.tier))
  const top = pictured.filter((picture) => picture.tier === highest)
  const pool = top.length >= count ? top : pictured
  const step = pool.length > count ? pool.length / count : 1
  const picks = Array.from({ length: Math.min(count, pool.length) }, (_, index) => pool[Math.floor(index * step)].url)
  // The front and its two sides take picks from the start, middle and end of the list, so the pieces seen first
  // differ even when the catalog is ordered group by group.
  return DISPLAY_ORDER.filter((index) => index < picks.length).map((index) => picks[index])
}

/** Which pick each slot takes, slot by slot. */
const DISPLAY_ORDER = [0, 3, 5, 1, 4, 2, 6]

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
 * to edge under the clear header, which names the part and frosts over the scene as the page scrolls. Each part may
 * bring a scene of its own and a caption about it; the others share the display of {@link ShowcasePieces}.
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

/** The shared scene: pictures set out like a display on a stand, one large in front and smaller ones behind. */
export function ShowcasePieces({ images, wide = false }: { images: string[]; wide?: boolean }) {
  const slots = wide ? SLOTS_WIDE : SLOTS_COMPACT
  return (
    <>
      <span className="wiki-warehouse-showcase-stand" style={{ "--piece-x": `${slots[0].x}%` } as CSSProperties} />
      {images.map((url, index) => {
        const slot = slots[index]
        return (
          <img
            key={`${index}-${url}`}
            src={url}
            alt=""
            decoding="async"
            className="wiki-warehouse-showcase-piece"
            data-depth={slot.depth}
            style={
              {
                "--piece-x": `${slot.x}%`,
                "--piece-y": `${slot.y}%`,
                "--piece-size": `${slot.size}px`,
                "--piece-turn": `${slot.turn}deg`,
              } as CSSProperties
            }
          />
        )
      })}
    </>
  )
}
