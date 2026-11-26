import { ChoiceRow, type ChoiceProps } from "./choice-row"
import "./choice-track.css"

/**
 * A switch between parts of a page, or between ways to look at one: a track, what is in view raised on it. What a list
 * is ordered by or measured in is chosen among words instead (`ChoiceWords`).
 */
export function ChoiceTrack<T extends string | null>({
  size,
  fill,
  page = false,
  className,
  ...row
}: ChoiceProps<T> & {
  /** Large for the parts of a whole tab, small beside other small controls. */
  size?: "large" | "small"
  /** Where it spreads over the whole width in equal parts: on compact layouts, or on phones alone. */
  fill?: "compact" | "phone"
  /** The choices are places of their own, so the one in use is the current page. */
  page?: boolean
  /** Places the track in its bar. */
  className?: string
}) {
  return (
    <ChoiceRow
      {...row}
      className={className ? `tn-choice-track ${className}` : "tn-choice-track"}
      size={size}
      fill={fill}
      current={page ? "page" : "true"}
    />
  )
}
