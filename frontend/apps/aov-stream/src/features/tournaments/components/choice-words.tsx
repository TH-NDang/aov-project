import { ChoiceRow, type ChoiceProps } from "./choice-row"
import "./choice-words.css"

/**
 * What a list is ordered by, or what it counts, as words in a row; the one in use is underlined. A switch between parts
 * or views is a track instead (`ChoiceTrack`).
 */
export function ChoiceWords<T extends string | null>(row: ChoiceProps<T>) {
  return <ChoiceRow {...row} className="tn-choice-words" />
}
