import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import type { PlaceZone } from "../../../lib/place-zones"
import { placesWords } from "../../../lib/standing-words"
import { openAnchor, wayAnchor } from "./standings-anchors"
import "./standings-zone.css"

/** How strong the mark of a zone is drawn: the best way solid, the next ones paler, the way out hollow. */
export const zoneMark = (zones: PlaceZone[], index: number) =>
  zones[index]!.way.kind === "OUT" ? "out" : index === 0 ? "first" : index === 1 ? "second" : "other"

/**
 * The heading of neighbouring places inside a table: where they lead, and which places they are. With `linked` the
 * words open the round or the table they name.
 */
export function ZoneHeading({
  zone,
  mark,
  words,
  columns,
  linked = false,
}: {
  zone: PlaceZone
  mark: ReturnType<typeof zoneMark>
  words: string
  /** How many columns the table has. */
  columns: number
  linked?: boolean
}) {
  const { text } = useStreamLocale()
  const anchor = linked ? wayAnchor(zone.way) : null
  return (
    <tr className="tn-zone">
      <th scope="rowgroup" colSpan={columns}>
        <span>
          <i data-mark={mark} aria-hidden="true" />
          {anchor ? (
            <a href={`#${anchor}`} onClick={openAnchor}>
              <span>{words}</span>
              <StreamIcon name={zone.way.kind === "ROUND" ? "bracket" : "table"} size={14} />
            </a>
          ) : (
            <b>{words}</b>
          )}
          <small>{placesWords(zone, text)}</small>
        </span>
      </th>
    </tr>
  )
}
