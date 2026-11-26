import type { CSSProperties } from "react"
import "./game-marks.css"

/** One game of a row of marks; `gap` starts another match. */
export type GameMark = { won: boolean | null; gap?: boolean }

/** Rows longer than this read as a bar of two parts, because marks thinner than three pixels are no marks. */
const MOST_MARKS = 60

/** The width of a cell that lets the longest row of a list fill `track` pixels; under three it is no cell any more. */
export const cellUnit = (longest: number, track: number) => Math.min(10, Math.floor(track / Math.max(1, longest)) - 1.5)

/**
 * Games in the order they were played, one mark each: tall and solid for a game won, short and pale for one lost, and
 * hollow while nobody knows. `fill` spreads the marks over the width instead of giving each the same. The figures stand
 * beside the marks.
 */
export function GameMarks({
  marks,
  unit = 7,
  height = 20,
  fill = false,
}: {
  marks: readonly (GameMark | boolean | null)[]
  unit?: number
  height?: number
  fill?: boolean
}) {
  const games = marks.map((mark): GameMark => (mark === null || typeof mark === "boolean" ? { won: mark } : mark))
  const won = games.filter((game) => game.won).length
  return (
    <span
      className="tn-marks"
      data-fill={fill || undefined}
      style={{ "--mark-unit": `${unit}px`, "--mark-height": `${height}px` } as CSSProperties}
      aria-hidden="true"
    >
      {games.length > MOST_MARKS && !fill ? (
        <span className="tn-marks-bar" style={{ "--share": won / games.length } as CSSProperties} />
      ) : (
        games.map((game, index) => (
          <i
            key={index}
            data-won={game.won === true || undefined}
            data-open={game.won === null || undefined}
            data-gap={(game.gap && index > 0) || undefined}
          />
        ))
      )}
    </span>
  )
}

/**
 * Games won, then games lost, one cell each: for rows where the order the games were played in says nothing. One unit
 * for all rows of a list, so a short row looks short; `whole` is the longest row, for lists too long for cells.
 */
export function GameCells({
  wins,
  losses,
  unit,
  whole,
  height = 16,
}: {
  wins: number
  losses: number
  unit: number
  whole: number
  height?: number
}) {
  const games = wins + losses
  const style = { "--mark-unit": `${unit}px`, "--mark-height": `${height}px` } as CSSProperties
  if (unit < 3)
    return (
      <span className="tn-marks" data-fill="" style={style} aria-hidden="true">
        <span
          className="tn-marks-bar"
          style={{ "--share": games ? wins / games : 0, "--length": games / (whole || 1) } as CSSProperties}
        />
      </span>
    )
  return (
    <span className="tn-marks" data-cells="" style={style} aria-hidden="true">
      {Array.from({ length: games }, (_, index) => (
        <i key={index} data-won={index < wins || undefined} />
      ))}
    </span>
  )
}
