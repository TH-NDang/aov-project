import type { CSSProperties, ReactNode } from "react"
import type { ModeImage } from "../auto-chess-model"
import { LaneMark, MapGlyph } from "@aov/ui/components/battle-map-glyph"
import {
  centre,
  frameWallPath,
  pathOf,
  roundedPath,
  terrainOf,
  type MapArea,
  type MapCallout,
  type MapContent,
  type MapLane,
  type MapObject,
  type Marker,
  type TerrainKind,
} from "@aov/ui/lib/battle-map"
import "./map-board.css"

/** A marker's icon: the uploaded one when Admin set it, otherwise the Wiki's drawing. */
export function ObjectIcon({
  object,
  images,
  size,
}: {
  object: MapObject
  images: Record<string, ModeImage>
  size: number
}) {
  const icon = object.iconAssetId ? images[object.iconAssetId] : undefined
  return icon ? (
    <img className="wiki-map-icon-picture" src={icon.url} alt="" width={size} height={size} loading="lazy" />
  ) : (
    <MapGlyph glyph={object.glyph} size={size} />
  )
}

/** How far each kind of terrain rounds its corners, in percent of the map: rock and water are soft, the floor less. */
const ROUNDING: Record<TerrainKind, number> = { JUNGLE: 2.5, RIVER: 3, BUSH: 1.5, WALL: 1.2 }

/** The wall around the whole map, drawn as part of the board's rim (see .wiki-map-board[data-walled]). */
const FRAME = frameWallPath()

/**
 * The traced ground of the map: the jungle floor with a faint grass grain, the river, bushes, and walls raised off the
 * floor by a cast shadow and a lit top edge, the wall around the map among them.
 */
function Terrain({ content }: { content: MapContent }) {
  const paths = (kind: TerrainKind) =>
    terrainOf(content, kind).map((shape) => roundedPath(shape.outline, ROUNDING[kind]))
  const walls = paths("WALL")
  return (
    <g className="wiki-map-terrain">
      {paths("JUNGLE").map((d, index) => (
        <g key={index}>
          <path className="wiki-map-jungle" d={d} />
          <path className="wiki-map-jungle-grain" d={d} />
        </g>
      ))}
      {paths("RIVER").map((d, index) => (
        <path key={index} className="wiki-map-river" d={d} />
      ))}
      {paths("BUSH").map((d, index) => (
        <path key={index} className="wiki-map-bush" d={d} />
      ))}
      <g className="wiki-map-wall-shadow" transform="translate(0.45 0.75)">
        <path d={FRAME} fillRule="evenodd" />
        {walls.map((d, index) => (
          <path key={index} d={d} />
        ))}
      </g>
      <g className="wiki-map-wall-rim" transform="translate(-0.2 -0.3)">
        <path d={FRAME} fillRule="evenodd" />
        {walls.map((d, index) => (
          <path key={index} d={d} />
        ))}
      </g>
      <g className="wiki-map-wall">
        <path className="wiki-map-frame" d={FRAME} fillRule="evenodd" />
        {walls.map((d, index) => (
          <path key={index} d={d} />
        ))}
      </g>
    </g>
  )
}

/**
 * The drawn battlefield, seen from above with the blue base at the bottom left: the ground and its areas, the lanes,
 * then a button for every place of every object shown. Markers keep their size in pixels whatever the size of the
 * board, so they stay easy to press on a phone; markers on one place fan out.
 */
export function MapBoard({
  content,
  images,
  markers,
  selected,
  onPick,
  showAreas,
  highlightArea,
  highlightLane,
  laneMarks,
  callouts = [],
  dimmed,
  children,
}: {
  content: MapContent
  images: Record<string, ModeImage>
  markers: Marker[]
  selected: string | null
  onPick: (ref: string) => void
  /** Draws every area's outline and name, as buttons. */
  showAreas: boolean
  highlightArea?: MapArea | null
  highlightLane?: MapLane | null
  /** The lanes tab marks each lane's role on the reader's side. */
  laneMarks?: boolean
  callouts?: MapCallout[]
  /** Markers drawn faint, such as those outside a chosen area. */
  dimmed?: ReadonlySet<string>
  /** Overlays such as the timeline's reminder. */
  children?: ReactNode
}) {
  const background = content.backgroundAssetId ? images[content.backgroundAssetId] : undefined
  const lanesLit = laneMarks || !!highlightLane
  // Traced terrain draws the river and the jungle itself, so areas only show when asked for or chosen.
  const terrain = !background && (content.terrain ?? []).length > 0
  const areas = terrain ? content.areas.filter((area) => showAreas || highlightArea?.code === area.code) : content.areas

  return (
    <div className="wiki-map-board" data-art={background ? "" : undefined} data-walled={terrain || undefined}>
      <div className="wiki-map-field">
        <svg
          className="wiki-map-ground"
          data-terrain={terrain || undefined}
          viewBox="0 0 100 100"
          aria-hidden="true"
          preserveAspectRatio="none"
        >
          <defs>
            <radialGradient id="wiki-map-blue" cx="0" cy="1" r="0.6">
              <stop offset="0" stopColor="var(--aov-wiki-info)" stopOpacity="0.32" />
              <stop offset="1" stopColor="var(--aov-wiki-info)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="wiki-map-red" cx="1" cy="0" r="0.6">
              <stop offset="0" stopColor="var(--aov-wiki-danger)" stopOpacity="0.3" />
              <stop offset="1" stopColor="var(--aov-wiki-danger)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="wiki-map-rock" x1="0" y1="0" x2="0.4" y2="1">
              <stop offset="0" className="wiki-map-rock-light" />
              <stop offset="1" className="wiki-map-rock-dark" />
            </linearGradient>
            <pattern id="wiki-map-grass" width="7" height="7" patternUnits="userSpaceOnUse">
              <path
                className="wiki-map-grass-blade"
                d="M0.8 1.6l0.25-0.6M1.3 1.7l-0.15-0.5M4.6 0.9l0.3-0.55M5.9 3.4l-0.2-0.6M2.7 4.2l0.3-0.6M3.1 4.3l-0.1-0.5M6.2 6.1l0.25-0.55M0.9 5.8l-0.2-0.5M4.1 6.6l0.2-0.5"
              />
            </pattern>
            <filter id="wiki-map-soften" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="0.35" />
            </filter>
          </defs>
          {background ? (
            <image href={background.url} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" />
          ) : (
            <rect className="wiki-map-earth" width="100" height="100" />
          )}
          {terrain && <Terrain content={content} />}
          <rect width="100" height="100" fill="url(#wiki-map-blue)" />
          <rect width="100" height="100" fill="url(#wiki-map-red)" />
          {areas.map((area) => (
            <path
              key={area.code}
              className="wiki-map-area"
              data-kind={area.code === "song" ? "river" : area.side ? "side" : "neutral"}
              data-side={area.side ?? undefined}
              data-outlined={showAreas || undefined}
              data-lit={highlightArea?.code === area.code || undefined}
              d={pathOf(area.outline, true)}
            />
          ))}
          {content.lanes
            .filter((lane) => lane.path.length > 1)
            .map((lane) => (
              <g
                key={lane.code}
                className="wiki-map-lane"
                data-lit={highlightLane?.code === lane.code || undefined}
                data-faint={(lanesLit && highlightLane && highlightLane.code !== lane.code) || undefined}
              >
                <path className="wiki-map-lane-bed" d={pathOf(lane.path)} />
                <path className="wiki-map-lane-line" d={pathOf(lane.path)} />
              </g>
            ))}
          {callouts.map((callout, index) => (
            <circle key={index} className="wiki-map-callout-ring" cx={callout.x} cy={callout.y} r="3.4" />
          ))}
        </svg>

        {showAreas &&
          content.areas.map((area) => {
            const middle = centre(area.outline)
            return (
              <button
                type="button"
                key={area.code}
                className="wiki-map-area-name"
                data-side={area.side ?? undefined}
                aria-pressed={selected === area.code}
                style={{ left: `${middle.x}%`, top: `${middle.y}%` }}
                onClick={() => onPick(area.code)}
              >
                {area.name}
              </button>
            )
          })}

        {laneMarks &&
          content.lanes.flatMap((lane) =>
            lane.positions.map((point, index) => (
              <button
                type="button"
                key={`${lane.code}-${index}`}
                className="wiki-map-lane-mark"
                aria-pressed={selected === lane.code}
                aria-label={lane.name}
                title={lane.name}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                onClick={() => onPick(lane.code)}
              >
                <LaneMark glyph={lane.glyph} size={18} />
              </button>
            )),
          )}

        {markers.map((marker) => {
          const { object, spot } = marker
          const spread = marker.stack - (marker.stackSize - 1) / 2
          const name = spot.label ? `${object.name} · ${spot.label}` : object.name
          return (
            <button
              type="button"
              key={marker.ref}
              className="wiki-map-marker"
              data-category={object.category}
              data-side={spot.side ?? undefined}
              data-dim={dimmed?.has(marker.ref) || undefined}
              aria-pressed={selected === marker.ref || selected === object.code}
              aria-label={name}
              title={name}
              style={{ left: `${spot.x}%`, top: `${spot.y}%`, "--spread": spread } as CSSProperties}
              onClick={() => onPick(marker.ref)}
            >
              <span className="wiki-map-marker-face">
                <ObjectIcon object={object} images={images} size={16} />
              </span>
              {object.category === "EPIC" && marker.stack === 0 && (
                <span className="wiki-map-marker-name">{object.name}</span>
              )}
            </button>
          )
        })}

        {callouts.map((callout, index) => (
          <span
            key={index}
            className="wiki-map-callout"
            data-flip={callout.x > 62 || undefined}
            style={{ left: `${callout.x}%`, top: `${callout.y}%` }}
          >
            {callout.label}
          </span>
        ))}
      </div>

      {children}
    </div>
  )
}
