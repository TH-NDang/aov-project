import type { ReactNode } from "react"
import { StreamIcon } from "../../../components/stream-icon"

/**
 * A section of a page: a title, at its end what orders the list or a link to the place that has all of it, then the
 * content.
 */
export function Section({
  id,
  title,
  note,
  control,
  more,
  children,
}: {
  /** Makes the section a landmark, named by its title. */
  id?: string
  title: string
  note?: ReactNode
  control?: ReactNode
  more?: { label: string; open: () => void }
  children: ReactNode
}) {
  return (
    <section className="tn-block" aria-labelledby={id}>
      <div className="tn-heading">
        <h2 id={id}>
          {title} {note && <small>{note}</small>}
        </h2>
        {control}
        {more && (
          <button type="button" onClick={more.open}>
            {more.label}
            <StreamIcon name="arrow" size={15} />
          </button>
        )}
      </div>
      {children}
    </section>
  )
}
