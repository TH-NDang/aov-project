import type { ReactNode } from "react"
import type { Glyph, LaneGlyph } from "../lib/battle-map"

/**
 * The project's own line drawings of map objects, on a 24-unit grid. They stand in for the game's icons until Admin
 * uploads one for the object; each keeps to a few strokes so it still reads inside a 20px marker.
 */
const GLYPHS: Record<Glyph, ReactNode> = {
  ALTAR: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 7.5v9M7.5 12h9" />
    </>
  ),
  BASE: <path d="M12 3 18.5 12 12 21 5.5 12ZM12 3v18M5.5 12h13" />,
  TOWER: <path d="M7 21h10M9 21l1-11h4l1 11M7.5 10h9V5.5l-2 1.2L12 4.5 9.5 6.7l-2-1.2Z" />,
  MINION: <path d="M5 19 17 7m-3-2.5h5v5M7.5 13.5l3 3M4 20l2.5-2.5" />,
  RANGED: <path d="M7 3.5c5 3 5 14 0 17M7 3.5v17M4 12h15m-3-3 3 3-3 3" />,
  SIEGE: (
    <>
      <circle cx="7.5" cy="17.5" r="2.5" />
      <circle cx="16.5" cy="17.5" r="2.5" />
      <path d="M4 13.5h16M9 13.5 17 5m-2.5-.5L18 8" />
    </>
  ),
  SUPER: (
    <path d="M12 3.5 19 6.5v5.5c0 4.2-3 7.2-7 8.5-4-1.3-7-4.3-7-8.5V6.5ZM12 8.5l1.3 2.6 2.7.4-2 1.9.5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-1.9 2.7-.4Z" />
  ),
  VANGUARD: <path d="M5 15a7 7 0 0 1 14 0v4H5ZM12 8V4m-4 11h8M3.5 6.5l3 3m14-3-3 3" />,
  MONSTER: (
    <>
      <path d="M8 16.5c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5-1.8 3-4 3-4-.5-4-3Z" />
      <circle cx="6" cy="10" r="1.7" />
      <circle cx="10" cy="6.5" r="1.7" />
      <circle cx="14" cy="6.5" r="1.7" />
      <circle cx="18" cy="10" r="1.7" />
    </>
  ),
  GIANT: <path d="M7 20.5v-7L9 8h6l2 5.5v7M9.5 12.5h5M10 8V5h4v3M4.5 14l2.5-.5m12.5.5-2.5-.5" />,
  DRAGON: (
    <path d="M3.5 18c3.5-.5 6-3.5 6.5-8.5 2 3.5 5.5 5 10.5 4.5-3.5 1.5-6.5 4.5-7.5 7.5-2-2.5-5.5-3.5-9.5-3.5ZM10 9.5 12.5 4l1.5 3.5" />
  ),
  CAESAR: <path d="M4.5 4.5 8 9.5h8l3.5-5M8 9.5v6l4 4.5 4-4.5v-6M10 13h.1m3.9 0h.1" />,
  BOSS: <path d="M4 18.5h16l1-10-5 3.5-4-7-4 7-5-3.5ZM6 21.5h12" />,
  KONG: (
    <>
      <circle cx="12" cy="12.5" r="7.5" />
      <path d="M9.5 11.5h.1m4.8 0h.1M9 16c1.8 1.2 4.2 1.2 6 0M4.5 12.5H3m18 0h-1.5" />
    </>
  ),
  EYE: (
    <>
      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  HEAL: <path d="M10 4.5h4v5.5h5.5v4H14v5.5h-4V14H4.5v-4H10Z" />,
  BUSH: (
    <path d="M4 20c1.5-4.5 2.5-8.5 2.5-12.5C8.5 11 9.5 15 9.5 20m0 0c.8-5.5 2.8-9.5 6-13.5.2 5-.6 9.5-1.8 13.5M13.7 20c1.6-2.6 3.6-4.5 6.3-5.5M3 20h18" />
  ),
  PORTAL: (
    <>
      <ellipse cx="12" cy="12" rx="5.5" ry="8.5" />
      <path d="M12 7c-1.5 1.5-1.5 8.5 0 10M4 4l2 2m14-2-2 2M4 20l2-2m14 2-2-2" />
    </>
  ),
}

const LANE_GLYPHS: Record<LaneGlyph, ReactNode> = {
  LANE: <path d="M4 20 4 4h16M8 20V8h12" />,
  JUNGLE: <path d="M12 3.5 6 13h3.5L6 20.5h12L14.5 13H18Z" />,
  MID: <path d="M4 20 20 4M4 14v6h6m4-16h6v6" />,
  SUPPORT: <path d="M12 3.5 19 6.5v5.5c0 4.2-3 7.2-7 8.5-4-1.3-7-4.3-7-8.5V6.5ZM12 8v8m-4-4h8" />,
}

const fallback = GLYPHS.MONSTER

function Drawing({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function MapGlyph({ glyph, size = 20 }: { glyph?: Glyph | null; size?: number }) {
  return <Drawing size={size}>{(glyph && GLYPHS[glyph]) || fallback}</Drawing>
}

export function LaneMark({ glyph, size = 20 }: { glyph?: LaneGlyph | null; size?: number }) {
  return <Drawing size={size}>{(glyph && LANE_GLYPHS[glyph]) || LANE_GLYPHS.LANE}</Drawing>
}
