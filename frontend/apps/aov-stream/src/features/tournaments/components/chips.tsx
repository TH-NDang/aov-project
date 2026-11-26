import type { ReactNode } from "react"
import { useStreamLocale } from "../../../components/stream-locale"
import "./chips.css"

export type Chip = {
  key: string
  name: ReactNode
  /** How many games the choice leaves. */
  games?: number
  on: boolean
  press: () => void
}

/** One thing a list can be narrowed by, its choices as chips; the chip in use lets go when pressed again. */
export function ChipGroup({
  title,
  chips,
  note,
  className = "",
}: {
  title: string
  chips: Chip[]
  /** What the choices leave out. */
  note?: string | null
  className?: string
}) {
  const { languageTag } = useStreamLocale()
  return (
    <section className={`tn-chips ${className}`} role="group" aria-label={title}>
      <h3>{title}</h3>
      <div>
        {chips.map(({ key, name, games, on, press }) => (
          <button key={key} type="button" className="tn-chip" aria-pressed={on} onClick={press}>
            {name}
            {games != null && <small>{games.toLocaleString(languageTag)}</small>}
          </button>
        ))}
      </div>
      {note && <p>{note}</p>}
    </section>
  )
}
