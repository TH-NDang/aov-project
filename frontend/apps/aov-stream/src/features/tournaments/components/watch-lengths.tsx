import { useEffect, useRef, type KeyboardEvent } from "react"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { useWatch } from "../../../components/use-watch"
import { watch } from "../../../components/watch-session"
import type { WatchMatch } from "../../../lib/watch-types"
import { lengthRows, lengthWords } from "../../../lib/watch-words"
import "./watch-lengths.css"

const STEPS: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }

/** How much of the match is watched, each with its real length. The arrows go through them; a press chooses. */
export function WatchLengths({ match }: { match: WatchMatch }) {
  const { text } = useStreamLocale()
  const length = useWatch((view) => view.length)
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => list.current?.querySelector<HTMLElement>("[aria-checked=true]")?.focus({ preventScroll: true }), [])
  const move = (event: KeyboardEvent) => {
    const step = STEPS[event.key]
    if (!step) return
    event.preventDefault()
    const choices = [...list.current!.querySelectorAll<HTMLElement>("[role=radio]")]
    const at = choices.findIndex((choice) => choice === document.activeElement)
    choices[(at + step + choices.length) % choices.length]?.focus()
  }
  const rows = lengthRows(match, text)
  const reached = rows.some((row) => row.length === length) ? length : rows[0]?.length
  return (
    <div
      ref={list}
      className="tn-room-lengths"
      role="radiogroup"
      aria-label={text("Thời lượng xem", "How much to watch")}
      onKeyDown={move}
    >
      {rows.map((row) => {
        const chosen = row.length === length
        return (
          <button
            key={row.length}
            type="button"
            role="radio"
            aria-checked={chosen}
            tabIndex={row.length === reached ? 0 : -1}
            onClick={() => watch.setLength(row.length)}
          >
            <b>
              {row.name}
              {chosen && <StreamIcon name="check" size={16} />}
            </b>
            {row.seconds != null && <span>{lengthWords(row.seconds, text)}</span>}
            <small>{row.what}</small>
          </button>
        )
      })}
    </div>
  )
}
