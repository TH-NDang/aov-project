import { useMemo, type CSSProperties } from "react"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import {
  ARCANA_PAGE_SLOTS,
  addPieces,
  byColor,
  fillColor,
  pageTotals,
  readArcanaPage,
  type PageArcana,
  type PagePiece,
  type PageTotal,
} from "./arcana-page-model"
import { ARCANA_COLORS, ARCANA_FAMILIES, arcanaRows, type ArcanaFamily, type WarehouseArcana } from "./use-item-catalog"
import { useShowcaseTurn } from "../../lib/use-showcase-turn"
import { arcanaFamilyName } from "./warehouse-arcana"
import { pageArcanaOf } from "./warehouse-arcana-page"
import { CatalogShowcase, type ShowcaseIntro } from "../../components/catalog-showcase"
import {
  warehouseImage,
  warehouseStatLabel,
  warehouseStatValue,
  type PublishedWarehouseRecord,
} from "../../lib/warehouse-types"
import "./warehouse-showcase-arcana.css"

/** One line of the page on show: its gem for the light behind it, and the picture in each of its ten slots. */
interface SceneLine {
  color: string
  glow: string | null
  slots: (string | null)[]
}

interface ArcanaScene {
  key: string
  /** The family a sample page serves, or null for the page the reader is building. */
  family: ArcanaFamily | null
  lines: SceneLine[]
  totals: PageTotal[]
  /** The page's level, as the core of the game's wheel shows it: the tiers of its pieces added up, 90 for a full tier III page. */
  level: number
}

/**
 * The arcana's head: an arcana page set out on a stand, three lines of ten slots filled with the game's gems. On the
 * list it shows a sample page for each stat family in turn; while the reader builds a page, it shows that page.
 */
export function ArcanaShowcase({
  intro,
  entries,
  params,
}: {
  intro: ShowcaseIntro
  entries: PublishedWarehouseRecord[]
  params: URLSearchParams
}) {
  const { locale } = useWikiContext()
  const { tier, pool, arcana } = useMemo(() => pageArcanaOf(entries), [entries])
  const samples = useMemo(() => samplePages(pool, arcana, tier, locale), [pool, arcana, tier, locale])
  const slots = params.get("view") === "page" ? params.get("slots") : null
  const own = useMemo(() => {
    const page = readArcanaPage(slots, arcana)
    return page.length ? sceneOf("own", null, page, pool, arcana) : null
  }, [slots, pool, arcana])
  const { scene, leaving } = useShowcaseTurn(own ? [own] : samples, picturesOfScene)
  const caption = scene && (
    // The caption changes with the scene every few seconds, so it is not read out each time.
    <p className="wiki-arcana-scene-caption" data-leaving={leaving || undefined} aria-hidden="true">
      <span>
        {scene.family
          ? wikiText(
              locale,
              `Bộ mẫu · ${arcanaFamilyName(scene.family, locale)}`,
              `Sample page · ${arcanaFamilyName(scene.family, locale)}`,
            )
          : wikiText(locale, "Bảng ngọc đang lắp", "The page being built")}
      </span>
      {scene.totals.slice(0, 2).map((total) => (
        <span key={`${total.key}|${total.unit ?? ""}`}>
          <b>{warehouseStatValue(total, locale)}</b> {warehouseStatLabel(total.key, undefined, locale)}
        </span>
      ))}
    </p>
  )
  return (
    <CatalogShowcase {...intro} scene={scene && <ArcanaScene scene={scene} leaving={leaving} />} caption={caption} />
  )
}

function picturesOfScene(scene: ArcanaScene) {
  return [...new Set(scene.lines.flatMap((line) => line.slots.filter((url): url is string => !!url)))]
}

/**
 * Where the slots stand, as the game draws its arcana screen: two rings, each color a third of them, red at the top,
 * purple at the lower right and green at the lower left. A third holds six slots on the outer ring, then four on the
 * inner one, each run going clockwise. Angles are degrees from the right, clockwise; radii are shares of the circle.
 */
const SECTOR_CENTERS: Record<string, number> = { RED: -90, PURPLE: 30, GREEN: 150 }
const OUTER = { radius: 43, step: 20, count: 6 }
const INNER = { radius: 28, step: 26, count: 4 }

function slotPlace(color: string, index: number) {
  const ring = index < OUTER.count ? OUTER : INNER
  const at = index < OUTER.count ? index : index - OUTER.count
  const angle = ((SECTOR_CENTERS[color] + (at - (ring.count - 1) / 2) * ring.step) * Math.PI) / 180
  return { x: 50 + ring.radius * Math.cos(angle), y: 50 + ring.radius * Math.sin(angle) }
}

/** The three spokes between the thirds, turned from pointing down: towards the lower left, the top and the lower right. */
const SPOKES = [0, 120, 240]

/** The middle of a color's third, between its two rings, where its light shines from. */
function sectorCenter(color: string) {
  const angle = (SECTOR_CENTERS[color] * Math.PI) / 180
  const radius = (OUTER.radius + INNER.radius) / 2
  return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) }
}

function ArcanaScene({ scene, leaving }: { scene: ArcanaScene; leaving: boolean }) {
  return (
    <div key={scene.key} className="wiki-arcana-scene" data-leaving={leaving || undefined}>
      <div className="wiki-arcana-scene-wheel">
        <span className="wiki-arcana-scene-rim" />
        {SPOKES.map((angle) => (
          <span key={angle} className="wiki-arcana-scene-spoke" style={{ "--spoke": `${angle}deg` } as CSSProperties} />
        ))}
        {scene.lines.map((line, row) => {
          const center = sectorCenter(line.color)
          return (
            line.glow && (
              <img
                key={`glow-${line.color}`}
                className="wiki-arcana-scene-glow"
                src={line.glow}
                alt=""
                decoding="async"
                style={
                  { "--piece-x": `${center.x}%`, "--piece-y": `${center.y}%`, "--piece-order": row } as CSSProperties
                }
              />
            )
          )
        })}
        <span className="wiki-arcana-scene-core">{scene.level}</span>
        {scene.lines.flatMap((line, row) =>
          line.slots.map((url, index) => {
            const place = slotPlace(line.color, index)
            const style = {
              "--piece-x": `${place.x}%`,
              "--piece-y": `${place.y}%`,
              "--piece-order": row * ARCANA_PAGE_SLOTS + index,
            } as CSSProperties
            return url ? (
              <img
                key={`${line.color}-${index}`}
                className="wiki-arcana-scene-gem"
                src={url}
                alt=""
                decoding="async"
                style={style}
              />
            ) : (
              <span key={`${line.color}-${index}`} className="wiki-arcana-scene-slot" style={style} />
            )
          }),
        )}
      </div>
    </div>
  )
}

/** A page drawn as the scene shows it: each color's pieces in place, the free slots left empty. */
function sceneOf(
  key: string,
  family: ArcanaFamily | null,
  page: PagePiece[],
  pool: WarehouseArcana[],
  arcana: PageArcana[],
): ArcanaScene {
  const ordered = byColor(page, arcana)
  const lines = ARCANA_COLORS.map((color) => {
    const pictures = ordered.flatMap((piece) => {
      const entry = pool.find((candidate) => candidate.code === piece.code)
      return entry?.content.color === color
        ? Array.from({ length: piece.count }, () => warehouseImage(entry) ?? null)
        : []
    })
    const gem = pool.find((entry) => entry.content.color === color)
    return {
      color,
      glow: pictures[0] ?? (gem ? (warehouseImage(gem) ?? null) : null),
      slots: Array.from({ length: ARCANA_PAGE_SLOTS }, (_, index) => pictures[index] ?? null),
    }
  })
  const level = page.reduce(
    (total, piece) => total + piece.count * (pool.find((entry) => entry.code === piece.code)?.content.tier ?? 0),
    0,
  )
  return { key, family, lines, totals: pageTotals(page, arcana), level }
}

/**
 * One full sample page per stat family: in each color the family's first two arcana, seven and three pieces, or ten of
 * the only one; a color without the family takes its first arcana. Left out unless every piece has a picture.
 */
function samplePages(pool: WarehouseArcana[], arcana: PageArcana[], tier: number, locale: string) {
  const rows = arcanaRows(pool, { color: "", tier: String(tier), stats: [] }, locale)
  return ARCANA_FAMILIES.flatMap((family) => {
    let page: PagePiece[] = []
    for (const color of ARCANA_COLORS) {
      const inColor = rows.filter(({ entry }) => entry.content.color === color)
      const own = inColor.filter((row) => row.family === family)
      const picks = (own.length ? own : inColor).map(({ entry }) => entry)
      if (picks.length > 1 && own.length > 1)
        page = addPieces(addPieces(page, arcana, picks[0].code, 7), arcana, picks[1].code, 3)
      else if (picks[0]) page = fillColor(page, arcana, picks[0].code)
    }
    const scene = sceneOf(family, family, page, pool, arcana)
    return scene.lines.every((line) => line.slots.every(Boolean)) ? [scene] : []
  })
}
