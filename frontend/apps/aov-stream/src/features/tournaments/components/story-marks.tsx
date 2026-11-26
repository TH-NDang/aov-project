import { memo } from "react"
import { marksOf } from "../../../lib/watch-bar"
import type { BarCell } from "../../../lib/watch-types"
import "./story-marks.css"

/** Pixels of the line both teams share. */
export const AXIS = 2

/**
 * The marks of a game: above the line what one team did, below it the other. `limit` is the second of the story up to
 * which they say whose they are; those after it only say that something happens. Nothing here follows the video, so
 * they are drawn again only when another mark has been passed.
 */
export const StoryMarks = memo(function StoryMarks({
  cell,
  limit,
  lane,
}: {
  cell: BarCell
  limit: number
  /** The height of the lane of a team. */
  lane: number
}) {
  return (
    <svg className="tn-story-marks" width={Math.ceil(cell.width)} height={lane * 2 + AXIS} aria-hidden="true">
      {marksOf(cell, limit).map(({ x, team, kind, ahead, ...mark }, index) => {
        const height = Math.min(mark.height, lane)
        const above = !ahead && team === "A"
        const below = !ahead && team === "B"
        return (
          <rect
            key={index}
            // A whole pixel keeps a thin mark sharp.
            x={Math.max(0, Math.round(x - cell.mark / 2))}
            y={above ? lane - height : below ? lane + AXIS : lane + (AXIS - height) / 2}
            width={cell.mark}
            height={height}
            rx={1}
            data-ahead={ahead || undefined}
            data-ban={kind === "BAN" || undefined}
          />
        )
      })}
    </svg>
  )
})
