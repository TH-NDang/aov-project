import type { RoomBar, RoomShape } from "./watch-types.ts"

/** The least height of the video: what YouTube allows, and what it gets beside a companion. */
const LEAST_HEIGHT = 200
const LEAST_HEIGHT_BESIDE = 210
/**
 * The least width of a companion beside the video: in a turned phone, where its five faces stand side by side, in a
 * window under 1240 px, and over it.
 */
const LEAST_COMPANION = { turned: 264, narrow: 296, wide: 320 }
const WIDEST_COMPANION = 420

const heightOf = (width: number) => Math.round((width * 9) / 16)
const widthOf = (height: number) => (height * 16) / 9

function barHeight(kind: RoomBar, shape: RoomShape["shape"], phone: boolean, height: number) {
  if (kind === "NONE") return 56
  if (kind === "TABS") return phone || shape === "turned" ? 56 : 60
  if (shape === "turned") return 52
  if (phone) return 98
  return shape === "side" && height < 560 ? 60 : 76
}

const densityOf = (height: number): RoomShape["density"] =>
  height >= 620 ? "roomy" : height >= 500 ? "short" : height >= 360 ? "mid" : "tight"

type Size = { width: number; height: number }
const isSideways = ({ width, height }: Size) => width > height

/** Whether a screen has been turned on its side; a keyboard that takes the half of it leaves its width. */
export const turnedOver = (before: Size, now: Size) =>
  isSideways(now) && !isSideways(before) && now.width > before.width

/** How the watch room stands in a window: where the companion goes, and how large the video can be. */
export function shapeOf(width: number, height: number, kind: RoomBar): RoomShape {
  const compact = width < 900
  const turned =
    compact && width / height >= 1.5 && height < 520 && heightOf(width - LEAST_COMPANION.turned) >= LEAST_HEIGHT
  const side = !compact && width / height >= 1.15
  const shape = kind === "NONE" ? "bare" : turned ? "turned" : side ? "side" : "stack"
  const phone = width < 600 && (shape === "bare" || shape === "stack")
  const bar = barHeight(kind, shape, phone, height)

  if (shape === "bare" || shape === "stack") {
    const own = shape === "stack" ? width : Math.round(Math.min(widthOf(height - bar), width))
    const video = { width: own, height: Math.max(LEAST_HEIGHT, heightOf(own)) }
    return { shape, phone, bar, video, companion: shape === "stack" ? width : 0, density: "roomy" }
  }

  const least = turned ? LEAST_COMPANION.turned : width >= 1240 ? LEAST_COMPANION.wide : LEAST_COMPANION.narrow
  const own = Math.round(Math.min(widthOf(Math.max(LEAST_HEIGHT_BESIDE, height - bar)), width - least))
  const video = { width: own, height: heightOf(own) }
  const companion = Math.min(WIDEST_COMPANION, width - own)
  return { shape, phone, bar, video, companion, density: densityOf(video.height) }
}
