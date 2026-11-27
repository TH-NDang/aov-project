import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import {
  roundedPath,
  TERRAIN_KINDS,
  terrainOf,
  type MapContent,
  type MapPoint,
  type Side,
  type TerrainKind,
} from "@aov/ui/lib/battle-map"
import { percent } from "./map-edit-model"

export interface CanvasPoint extends MapPoint {
  id: string
  /** Short text inside the handle, such as its number. */
  mark?: string
  side?: Side | null
  title?: string
}

const SIDE_COLOR: Record<Side | "NONE", string> = {
  BLUE: "var(--aov-info)",
  RED: "var(--aov-danger)",
  NONE: "var(--aov-game-gold)",
}

/** How the editor draws each kind of terrain, a quieter version of the Wiki's ground. */
export const TERRAIN_STYLE: Record<TerrainKind, { fill: string; opacity: number; round: number }> = {
  JUNGLE: { fill: "var(--aov-success)", opacity: 0.12, round: 2.5 },
  RIVER: { fill: "var(--aov-info)", opacity: 0.3, round: 3 },
  BUSH: { fill: "var(--aov-success)", opacity: 0.35, round: 1.5 },
  WALL: { fill: "var(--foreground)", opacity: 0.32, round: 1.2 },
}

/** Every traced shape of the ground, from the floor up, as faint fills. */
export function TerrainShapes({ content }: { content: MapContent }) {
  return TERRAIN_KINDS.flatMap((kind) =>
    terrainOf(content, kind).map((shape, index) => (
      <path
        key={`${kind}-${index}`}
        d={roundedPath(shape.outline, TERRAIN_STYLE[kind].round)}
        fill={TERRAIN_STYLE[kind].fill}
        fillOpacity={TERRAIN_STYLE[kind].opacity}
      />
    )),
  )
}

const pathOf = (points: readonly MapPoint[]) => points.map((point) => `${point.x},${point.y}`).join(" ")

/**
 * The map as a square where the places of one entry are edited: tap the ground to add a place, drag a handle to move
 * it, or select it and nudge it with the arrow keys. The terrain and every other object, area and lane are drawn faintly
 * underneath so a place can be set against its neighbours.
 */
export function MapCanvas({
  content,
  background,
  points,
  shape = "points",
  selected,
  onSelect,
  onMove,
  onAdd,
  label,
}: {
  content: MapContent
  background?: string
  points: CanvasPoint[]
  /** Joins the handles into an outline or a route. */
  shape?: "points" | "outline" | "route"
  selected?: string | null
  onSelect?: (id: string) => void
  onMove: (id: string, point: MapPoint) => void
  onAdd?: (point: MapPoint) => void
  label: string
}) {
  const board = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  const pointAt = (event: { clientX: number; clientY: number }): MapPoint | null => {
    const box = board.current?.getBoundingClientRect()
    if (!box?.width || !box.height) return null
    return {
      x: percent(((event.clientX - box.left) / box.width) * 100),
      y: percent(((event.clientY - box.top) / box.height) * 100),
    }
  }
  const startDrag = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(id)
    onSelect?.(id)
  }
  const drag = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (dragging !== id) return
    const point = pointAt(event)
    if (point) onMove(id, point)
  }
  const nudge = (event: KeyboardEvent<HTMLButtonElement>, point: CanvasPoint) => {
    const step = event.shiftKey ? 2 : 0.5
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key]
    if (!delta) return
    event.preventDefault()
    onMove(point.id, { x: percent(point.x + delta[0]!), y: percent(point.y + delta[1]!) })
  }

  return (
    <div className="grid content-start gap-1.5 lg:sticky lg:top-14">
      <div
        ref={board}
        role="group"
        aria-label={label}
        className="relative aspect-square w-full touch-none overflow-hidden rounded-lg border bg-muted select-none"
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className={`absolute inset-0 size-full ${onAdd ? "cursor-crosshair" : ""}`}
          onClick={(event) => {
            const point = onAdd && pointAt(event)
            if (point) onAdd(point)
          }}
        >
          <defs>
            <radialGradient id="admin-map-blue" cx="0" cy="1" r="0.6">
              <stop offset="0" stopColor="var(--aov-info)" stopOpacity="0.3" />
              <stop offset="1" stopColor="var(--aov-info)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="admin-map-red" cx="1" cy="0" r="0.6">
              <stop offset="0" stopColor="var(--aov-danger)" stopOpacity="0.28" />
              <stop offset="1" stopColor="var(--aov-danger)" stopOpacity="0" />
            </radialGradient>
          </defs>
          {background && <image href={background} width="100" height="100" preserveAspectRatio="xMidYMid slice" />}
          {!background && <TerrainShapes content={content} />}
          <rect width="100" height="100" fill="url(#admin-map-blue)" />
          <rect width="100" height="100" fill="url(#admin-map-red)" />
          {content.areas.map((area) => (
            <polygon
              key={area.code}
              points={pathOf(area.outline)}
              fill="var(--aov-game-gold)"
              fillOpacity="0.05"
              stroke="var(--aov-game-gold)"
              strokeOpacity="0.35"
              strokeWidth="0.25"
              strokeDasharray="1 0.8"
            />
          ))}
          {content.lanes.map((lane) => (
            <polyline
              key={lane.code}
              points={pathOf(lane.path)}
              fill="none"
              stroke="var(--muted-foreground)"
              strokeOpacity="0.35"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {content.objects.flatMap((object) =>
            object.positions.map((spot, index) => (
              <circle
                key={`${object.code}-${index}`}
                cx={spot.x}
                cy={spot.y}
                r="1"
                fill={SIDE_COLOR[spot.side ?? "NONE"]}
                fillOpacity="0.45"
              >
                <title>{object.name}</title>
              </circle>
            )),
          )}
          {shape === "outline" && points.length > 1 && (
            <polygon
              points={pathOf(points)}
              fill="var(--aov-game-gold)"
              fillOpacity="0.18"
              stroke="var(--aov-game-gold)"
              strokeWidth="0.5"
            />
          )}
          {shape === "route" && points.length > 1 && (
            <polyline
              points={pathOf(points)}
              fill="none"
              stroke="var(--aov-game-gold)"
              strokeWidth="0.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
        {points.map((point) => (
          <button
            key={point.id}
            type="button"
            title={point.title}
            aria-label={`${point.title ?? "Điểm"}: ${point.x}, ${point.y}`}
            aria-pressed={selected === point.id}
            onPointerDown={(event) => startDrag(event, point.id)}
            onPointerMove={(event) => drag(event, point.id)}
            onPointerUp={() => setDragging(null)}
            onPointerCancel={() => setDragging(null)}
            onKeyDown={(event) => nudge(event, point)}
            onFocus={() => onSelect?.(point.id)}
            className={`type-label absolute grid ${shape === "outline" ? "size-5" : "size-7"} -translate-x-1/2 -translate-y-1/2 cursor-grab place-items-center rounded-full border-2 border-background text-white shadow-md active:cursor-grabbing ${
              selected === point.id ? "z-10 ring-2 ring-foreground" : ""
            }`}
            style={{ left: `${point.x}%`, top: `${point.y}%`, background: SIDE_COLOR[point.side ?? "NONE"] }}
          >
            {point.mark}
          </button>
        ))}
      </div>
      <p className="type-meta">
        {onAdd ? "Chạm vào bản đồ để thêm điểm. " : ""}Kéo điểm để dời; chọn điểm rồi dùng phím mũi tên để chỉnh nhỏ
        (giữ Shift để bước lớn).
      </p>
    </div>
  )
}
